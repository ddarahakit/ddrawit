import { state, resetPendingLinkState } from './state.js';
import { ICON_LIST } from './constants.js';
import { 
    canvasWrapper, zoomLabel, toolButtons, btnLinkTool, workspace, 
    inventoryList, deviceCount, propertyEditor, nodeLayer, drawingLayer 
} from './dom.js';
import { getIconClass } from './utils.js';
import { renderNode } from './node.js';
import { renderDrawing } from './drawing.js';
import { renderLinks } from './link.js';

export function setActiveTool(tool) {
    state.currentTool = tool;
    Object.values(toolButtons).forEach(btn => { if (btn) btn.classList.remove('active'); });
    if (toolButtons[tool]) toolButtons[tool].classList.add('active');
    if (tool !== 'select') { 
        state.isDrawingLink = false; 
        btnLinkTool.classList.remove('active'); 
    }
    workspace.style.cursor = (tool === 'select' && !state.isDrawingLink) ? 'grab' : 'crosshair';
}

export function updateZoom(delta) { 
    state.zoom = Math.max(0.2, Math.min(3, state.zoom + delta)); 
    applyZoom(); 
}

export function applyZoom() { 
    canvasWrapper.style.transform = `scale(${state.zoom})`; 
    zoomLabel.textContent = Math.round(state.zoom * 100) + '%'; 
}

export function clearSelections() { 
    document.querySelectorAll('.node, .shape').forEach(el => el.classList.remove('selected')); 
}

export function resetPendingLink() { 
    resetPendingLinkState();
    clearSelections(); 
    state.isDrawingLink = false;
    btnLinkTool.classList.remove('active'); 
    workspace.style.cursor = 'grab';
}

export function onMouseMove(e) {
    if (!state.draggedElement) return;
    const el = state.draggedElement;
    const curX = e.clientX / state.zoom; 
    const curY = e.clientY / state.zoom;

    if (state.dragType === 'resize') {
        const dx = curX - state.offset.startX; 
        const dy = curY - state.offset.startY;
        if (state.resizeDir.includes('r')) el.w = Math.max(20, state.offset.w + dx);
        if (state.resizeDir.includes('b')) el.h = Math.max(20, state.offset.h + dy);
        if (state.resizeDir.includes('l')) { el.x = state.offset.x + dx; el.w = Math.max(20, state.offset.w - dx); }
        if (state.resizeDir.includes('t')) { el.y = state.offset.y + dy; el.h = Math.max(20, state.offset.h - dy); }
    } else {
        el.x = curX - state.offset.x; 
        el.y = curY - state.offset.y;
    }

    const dom = document.getElementById(el.id);
    if (dom) {
        dom.style.left = el.x + 'px'; 
        dom.style.top = el.y + 'px';
        if (state.dragType === 'resize') { 
            dom.style.width = el.w + 'px'; 
            dom.style.height = el.h + 'px'; 
        }
    }
    if (state.dragType === 'node') renderLinks();
}

export function onMouseUp() {
    state.draggedElement = null;
    document.removeEventListener('mousemove', onMouseMove); 
    document.removeEventListener('mouseup', onMouseUp);
}

export function renderInventory() {
    inventoryList.innerHTML = ''; 
    deviceCount.textContent = `${state.nodes.length} devices`;
    if (state.nodes.length === 0) { 
        inventoryList.innerHTML = '<div class="empty-state">No devices added yet.</div>'; 
        return; 
    }
    state.nodes.forEach(node => {
        const item = document.createElement('div');
        item.className = 'inventory-item';
        
        let iconHtml = '';
        if (node.customIcon) {
            iconHtml = `<img src="assets/icons/${encodeURIComponent(node.customIcon)}" style="width:20px;height:20px;object-fit:contain;">`;
        } else {
            iconHtml = `<i class="${getIconClass(node.type)}"></i>`;
        }
        
        item.innerHTML = `<div class="item-header"><div class="status-indicator ${node.status}"></div>${iconHtml}</div><div class="item-info"><span class="item-name">${node.label}</span><span class="item-type">${node.type}</span></div>`;
        item.onclick = () => { 
            clearSelections(); 
            const nodeEl = document.getElementById(node.id);
            if (nodeEl) nodeEl.classList.add('selected'); 
            renderProperties(node.id); 
        };
        inventoryList.appendChild(item);
    });
}

export function renderProperties(id) {
    if (!id) { 
        propertyEditor.innerHTML = '<div class="empty-state property-empty">Select an item to edit properties.</div>'; 
        return; 
    }

    const node = state.nodes.find(n => n.id === id);
    const draw = state.drawings.find(d => d.id === id);

    if (node) {
        renderNodeProperties(node);
    } else if (draw) {
        renderShapeProperties(draw);
    }
}

function renderNodeProperties(node) {
    propertyEditor.innerHTML = `
        <div class="property-group">
            <label>Hostname</label>
            <input type="text" id="prop-hostname" value="${node.label}">
        </div>
        <div class="property-row">
            <div class="property-group">
                <label>IP Address</label>
                <input type="text" id="prop-ip" value="${node.ip}" placeholder="192.168.1.1">
            </div>
            <div class="property-group">
                <label>Subnet Mask</label>
                <input type="text" id="prop-subnet" value="${node.subnet}" placeholder="255.255.255.0">
            </div>
        </div>
        <div class="property-group">
            <label>Port Management</label>
            <div class="prop-port-counter">
                <button onclick="changePortCount('${node.id}', -1)">-</button>
                <input type="number" value="${node.ports.length}" readonly>
                <button onclick="changePortCount('${node.id}', 1)">+</button>
            </div>
        </div>
        <div class="property-group">
            <label>Change Icon</label>
            <div id="icon-grid-container" class="icon-grid-container"></div>
        </div>
    `;

    document.getElementById('prop-hostname').oninput = (e) => {
        node.label = e.target.value;
        const nodeEl = document.getElementById(node.id);
        if (nodeEl) nodeEl.querySelector('.node-label').value = e.target.value;
        renderInventory();
    };

    document.getElementById('prop-ip').oninput = (e) => {
        node.ip = e.target.value;
        const nodeEl = document.getElementById(node.id);
        if (nodeEl) {
            nodeEl.querySelector('.node-ip').textContent = node.ip || 'No IP';
        }
    };

    document.getElementById('prop-subnet').oninput = (e) => {
        node.subnet = e.target.value;
    };

    renderIconGrid(node);
}

function renderShapeProperties(draw) {
    propertyEditor.innerHTML = `
        <div class="property-group">
            <label>Shape Text</label>
            <textarea id="prop-shape-text" style="width: 100%; height: 60px; padding: 8px; border: 1px solid var(--border-color); border-radius: 6px;">${draw.text || ''}</textarea>
        </div>
        <div class="property-row">
            <div class="property-group">
                <label>Color</label>
                <input type="color" id="prop-shape-color" value="${draw.color}" style="width: 100%; height: 32px; padding: 2px;">
            </div>
            <div class="property-group">
                <label>Opacity</label>
                <input type="range" id="prop-shape-opacity" min="0" max="1" step="0.1" value="${draw.opacity}" style="width: 100%;">
            </div>
        </div>
        <div class="property-row">
            <div class="property-group">
                <label>Border Style</label>
                <select id="prop-shape-border" style="width: 100%; padding: 8px; border: 1px solid var(--border-color); border-radius: 6px;">
                    <option value="solid" ${draw.borderStyle === 'solid' ? 'selected' : ''}>Solid</option>
                    <option value="dashed" ${draw.borderStyle === 'dashed' ? 'selected' : ''}>Dashed</option>
                    <option value="dotted" ${draw.borderStyle === 'dotted' ? 'selected' : ''}>Dotted</option>
                    <option value="double" ${draw.borderStyle === 'double' ? 'selected' : ''}>Double</option>
                </select>
            </div>
            <div class="property-group">
                <label>Z-Index</label>
                <div class="prop-port-counter">
                    <button id="btn-z-dec">-</button>
                    <input type="number" id="prop-shape-z" value="${draw.zIndex}" readonly>
                    <button id="btn-z-inc">+</button>
                </div>
            </div>
        </div>
        <div class="property-row">
            <div class="property-group">
                <label>Align</label>
                <select id="prop-shape-align" style="width: 100%; padding: 8px; border: 1px solid var(--border-color); border-radius: 6px;">
                    <option value="left" ${draw.textAlign === 'left' ? 'selected' : ''}>Left</option>
                    <option value="center" ${draw.textAlign === 'center' ? 'selected' : ''}>Center</option>
                    <option value="right" ${draw.textAlign === 'right' ? 'selected' : ''}>Right</option>
                </select>
            </div>
            <div class="property-group">
                <label>Baseline</label>
                <select id="prop-shape-baseline" style="width: 100%; padding: 8px; border: 1px solid var(--border-color); border-radius: 6px;">
                    <option value="top" ${draw.textBaseline === 'top' ? 'selected' : ''}>Top</option>
                    <option value="middle" ${draw.textBaseline === 'middle' ? 'selected' : ''}>Middle</option>
                    <option value="bottom" ${draw.textBaseline === 'bottom' ? 'selected' : ''}>Bottom</option>
                </select>
            </div>
        </div>
    `;

    document.getElementById('prop-shape-text').oninput = (e) => {
        draw.text = e.target.value;
        const el = document.getElementById(draw.id);
        if (el) el.querySelector('.shape-text').textContent = draw.text;
    };

    document.getElementById('prop-shape-color').oninput = (e) => {
        draw.color = e.target.value;
        renderAll();
    };

    document.getElementById('prop-shape-opacity').oninput = (e) => {
        draw.opacity = e.target.value;
        renderAll();
    };

    document.getElementById('prop-shape-border').onchange = (e) => {
        draw.borderStyle = e.target.value;
        renderAll();
    };

    document.getElementById('btn-z-inc').onclick = () => {
        draw.zIndex++;
        document.getElementById('prop-shape-z').value = draw.zIndex;
        renderAll();
    };

    document.getElementById('btn-z-dec').onclick = () => {
        draw.zIndex = Math.max(1, draw.zIndex - 1);
        document.getElementById('prop-shape-z').value = draw.zIndex;
        renderAll();
    };

    document.getElementById('prop-shape-align').onchange = (e) => {
        draw.textAlign = e.target.value;
        renderAll();
    };

    document.getElementById('prop-shape-baseline').onchange = (e) => {
        draw.textBaseline = e.target.value;
        renderAll();
    };
}


export function renderIconGrid(node) {
    const container = document.getElementById('icon-grid-container');
    if (!container) return;

    ICON_LIST.forEach(cat => {
        const catLabel = document.createElement('div');
        catLabel.className = 'icon-cat-label';
        catLabel.textContent = cat.category;
        container.appendChild(catLabel);

        const grid = document.createElement('div');
        grid.className = 'icon-thumb-grid';

        cat.icons.forEach(iconFile => {
            const thumbWrap = document.createElement('div');
            thumbWrap.className = 'icon-thumb-wrap' + (node.customIcon === iconFile ? ' active' : '');
            thumbWrap.innerHTML = `<img class="icon-thumb" src="assets/icons/${encodeURIComponent(iconFile)}" alt="${iconFile}">`;
            thumbWrap.onclick = () => {
                node.customIcon = iconFile;
                renderAll();
                renderProperties(node.id);
            };
            grid.appendChild(thumbWrap);
        });
        container.appendChild(grid);
    });

    const resetBtn = document.createElement('button');
    resetBtn.className = 'btn-reset-icon';
    resetBtn.textContent = 'Reset to Default';
    resetBtn.onclick = () => {
        node.customIcon = null;
        renderAll();
        renderProperties(node.id);
    };
    container.appendChild(resetBtn);
}

export function renderAll() {
    nodeLayer.innerHTML = ''; 
    drawingLayer.innerHTML = ''; 
    renderLinks(); 
    renderInventory();
    state.nodes.forEach(n => renderNode(n)); 
    state.drawings.forEach(d => renderDrawing(d));
}

export function updateNodeStatus(nodeId, newStatus) {
    const node = state.nodes.find(n => n.id === nodeId);
    if (node) { 
        node.status = newStatus; 
        const nodeEl = document.getElementById(nodeId); 
        if (nodeEl) nodeEl.className = `node ${newStatus}`; 
        renderInventory(); 
        renderProperties(nodeId); 
    }
}

window.changePortCount = (nodeId, delta) => {
    const node = state.nodes.find(n => n.id === nodeId);
    if (node) {
        const newCount = Math.max(1, node.ports.length + delta);
        const oldCount = node.ports.length;
        if (newCount > oldCount) {
            for (let i = oldCount; i < newCount; i++) node.ports.push(`p${i}`);
        } else if (newCount < oldCount) {
            const removedPorts = node.ports.splice(newCount);
            state.links = state.links.filter(l => !(l.sourceId === node.id && removedPorts.includes(l.sourcePort)) && !(l.targetId === node.id && removedPorts.includes(l.targetPort)));
            node.usedPorts = node.usedPorts.filter(p => !removedPorts.includes(p));
        }
        renderAll(); 
        renderProperties(nodeId);
    }
};
