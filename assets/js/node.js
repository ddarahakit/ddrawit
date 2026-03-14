import { state } from './state.js';
import { nodeLayer, contextMenu, shapeProps } from './dom.js';
import { getInitialPorts, getIconClass } from './utils.js';
import { renderInventory, renderProperties, clearSelections, onMouseMove, onMouseUp } from './ui.js';
import { handleLinkInteraction } from './link.js';

export function createNode(type, x, y) {
    const node = { 
        id: 'node_' + Date.now(), 
        type, 
        x, 
        y, 
        label: `${type.toUpperCase()} ${state.nodes.length + 1}`, 
        ip: '', 
        subnet: '',
        ports: getInitialPorts(type), 
        usedPorts: [], 
        status: 'stopped',
        customIcon: null,
        cpu: type === 'server' ? 4 : 2, // Default CPU cores
        ram: type === 'server' ? 8 : 4  // Default RAM GB
    };
    state.nodes.push(node); 
    renderNode(node); 
    renderInventory();
}

export function renderNode(node) {
    const nodeEl = document.createElement('div');
    nodeEl.className = `node ${node.status}`;
    nodeEl.id = node.id;
    nodeEl.style.left = node.x + 'px';
    nodeEl.style.top = node.y + 'px';

    let iconHtml = '';
    if (node.customIcon) {
        iconHtml = `<img src="assets/icons/${encodeURIComponent(node.customIcon)}" alt="${node.type}" draggable="false">`;
    } else {
        iconHtml = `<i class="${getIconClass(node.type)}"></i>`;
    }

    nodeEl.innerHTML = `
        <div class="node-icon">${iconHtml}</div>
        <div class="node-labels">
            <input type="text" class="node-label" value="${node.label}">
            <div class="node-ip">${node.ip || 'No IP'}</div>
        </div>
    `;

    nodeEl.addEventListener('mousedown', (e) => {
        if (e.button !== 0 || e.target.tagName === 'INPUT') return;
        if (state.isDrawingLink) { 
            e.stopPropagation(); 
            handleLinkInteraction(node.id, e.clientX, e.clientY); 
            return; 
        }
        if (state.currentTool !== 'select') return;
        e.stopPropagation();
        state.draggedElement = node; 
        state.dragType = 'node';
        state.offset.x = e.clientX / state.zoom - node.x; 
        state.offset.y = e.clientY / state.zoom - node.y;
        clearSelections(); 
        nodeEl.classList.add('selected');
        renderProperties(node.id);
        const propertiesTab = document.querySelector('.sidebar-tab[data-tab="properties"]');
        if (propertiesTab) propertiesTab.click();
        document.addEventListener('mousemove', onMouseMove); 
        document.addEventListener('mouseup', onMouseUp);
    });

    nodeEl.querySelector('.node-label').onchange = (e) => { 
        node.label = e.target.value; 
        renderInventory(); 
        renderProperties(node.id); 
    };
    
    nodeEl.oncontextmenu = (e) => {
        e.preventDefault(); 
        e.stopPropagation(); 
        state.contextTargetId = node.id;
        contextMenu.style.display = 'block'; 
        contextMenu.style.left = e.clientX + 'px'; 
        contextMenu.style.top = e.clientY + 'px';
        shapeProps.style.display = 'none';
    };
    
    nodeLayer.appendChild(nodeEl);
}
