import { state, pendingLink } from './state.js';
import { 
    workspace, canvasWrapper, nodeLayer, drawingLayer, 
    contextMenu, shapeProps, propColor, propOpacity, 
    portModal, serverAppPortInput, btnConfirmServerPort,
    btnLinkTool, toolButtons, zoomLabel,
    simulationModal, simTotalRps, simLbAlgo, simSpecTable,
    simSpecTbody, simNoRoles, simStartBtn, simCancelBtn, btnSimulate
} from './dom.js';
import { createNode } from './node.js';
import { createDrawing } from './drawing.js';
import { renderLinks } from './link.js';
import { 
    setActiveTool, updateZoom, applyZoom, renderAll, 
    renderProperties, clearSelections, resetPendingLink, updateNodeStatus 
} from './ui.js';

// --- Initialization ---

document.querySelectorAll('.toolbox-item').forEach(item => {
    item.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('type', item.dataset.type);
    });
});

workspace.addEventListener('dragover', (e) => e.preventDefault());
workspace.addEventListener('drop', (e) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('type');
    if (!type) return;
    const rect = canvasWrapper.getBoundingClientRect();
    createNode(type, (e.clientX - rect.left) / state.zoom - 50, (e.clientY - rect.top) / state.zoom - 40);
});

workspace.addEventListener('mousemove', (e) => {
    if (state.isDrawingLink && pendingLink.sourceId) {
        const rect = canvasWrapper.getBoundingClientRect();
        const mouseX = (e.clientX - rect.left) / state.zoom;
        const mouseY = (e.clientY - rect.top) / state.zoom;
        renderLinks(mouseX, mouseY);
    }
});

// --- Tab Logic ---

document.querySelectorAll('.sidebar-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        const target = tab.dataset.tab;
        document.querySelectorAll('.sidebar-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        
        tab.classList.add('active');
        document.getElementById(`tab-${target}`).classList.add('active');
    });
});

function switchToTab(tabName) {
    const tab = document.querySelector(`.sidebar-tab[data-tab="${tabName}"]`);
    if (tab) tab.click();
}

// Update existing listeners to switch tabs
workspace.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    if (e.target !== workspace && e.target !== canvasWrapper && e.target !== nodeLayer && e.target !== drawingLayer) return;
    const rect = canvasWrapper.getBoundingClientRect();
    const x = (e.clientX - rect.left) / state.zoom;
    const y = (e.clientY - rect.top) / state.zoom;
    if (['rect', 'circle', 'diamond', 'container'].includes(state.currentTool)) createDrawing(state.currentTool, x, y);
    clearSelections();
    renderProperties(null);
});

workspace.addEventListener('wheel', (e) => { 
    e.preventDefault(); 
    updateZoom(e.deltaY > 0 ? -0.1 : 0.1); 
}, { passive: false });

Object.keys(toolButtons).forEach(tool => {
    if (toolButtons[tool]) {
        toolButtons[tool].addEventListener('click', () => setActiveTool(tool));
    }
});

// --- Simulation Logic ---

btnSimulate.addEventListener('click', () => {
    const servers = state.nodes.filter(n => n.type === 'server');
    simSpecTbody.innerHTML = '';
    
    if (servers.length === 0) {
        simSpecTable.style.display = 'none';
        simNoRoles.style.display = 'block';
    } else {
        simSpecTable.style.display = 'table';
        simNoRoles.style.display = 'none';
        servers.forEach(srv => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="max-width:100px;overflow:hidden;text-overflow:ellipsis" title="${srv.label}">${srv.label}</td>
                <td>Server</td>
                <td><input type="number" min="1" max="128" value="${srv.cpu || 4}" data-id="${srv.id}" class="sim-cpu-input"></td>
                <td><input type="number" min="1" value="${srv.ram || 8}" data-id="${srv.id}" class="sim-ram-input"></td>
            `;
            simSpecTbody.appendChild(tr);
        });
    }
    
    simulationModal.style.display = 'flex';
});

simStartBtn.onclick = () => {
    // Update server specs from table
    document.querySelectorAll('.sim-cpu-input').forEach(input => {
        const id = input.dataset.id;
        const node = state.nodes.find(n => n.id === id);
        if (node) node.cpu = parseInt(input.value);
    });
    document.querySelectorAll('.sim-ram-input').forEach(input => {
        const id = input.dataset.id;
        const node = state.nodes.find(n => n.id === id);
        if (node) node.ram = parseInt(input.value);
    });

    state.isSimulating = true;
    const rps = parseInt(simTotalRps.value);
    state.simulationLoad = Math.min(100, Math.round((rps / 5000) * 100)); 
    
    simulationModal.style.display = 'none';
    renderAll();
};

simCancelBtn.onclick = () => {
    simulationModal.style.display = 'none';
};

// --- Link Tool ---

btnLinkTool.addEventListener('click', (e) => {
    e.stopPropagation();
    state.isDrawingLink = !state.isDrawingLink;
    btnLinkTool.classList.toggle('active', state.isDrawingLink);
    if (state.isDrawingLink) { 
        setActiveTool('select'); 
        workspace.style.cursor = 'crosshair'; 
    }
    else { 
        resetPendingLink(); 
        workspace.style.cursor = 'grab'; 
    }
});

document.getElementById('btn-zoom-in').onclick = () => updateZoom(0.1);
document.getElementById('btn-zoom-out').onclick = () => updateZoom(-0.1);
document.getElementById('btn-zoom-reset').onclick = () => { state.zoom = 1.0; applyZoom(); };

// --- Save & Load Logic ---

document.getElementById('btn-save').onclick = () => {
    const data = {
        nodes: state.nodes,
        links: state.links,
        drawings: state.drawings,
        version: '3.7'
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `architecture-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
};

document.getElementById('btn-load').onclick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (re) => {
            try {
                const data = JSON.parse(re.target.result);
                state.nodes = data.nodes || [];
                state.links = data.links || [];
                state.drawings = data.drawings || [];
                renderAll();
                renderProperties(null);
                alert('Project loaded successfully!');
            } catch (err) {
                alert('Failed to load file: Invalid JSON structure.');
            }
        };
        reader.readAsText(file);
    };
    input.click();
};

document.getElementById('btn-clear-canvas').onclick = () => { 
    if (confirm('Clear?')) { 
        state.nodes = []; 
        state.links = []; 
        state.drawings = []; 
        renderAll(); 
        renderProperties(null); 
    } 
};

document.addEventListener('click', (e) => {
    if (!contextMenu.contains(e.target)) contextMenu.style.display = 'none';
});

propColor.oninput = (e) => {
    const draw = state.drawings.find(d => d.id === state.contextTargetId);
    if (draw) { draw.color = e.target.value; renderAll(); }
};
propOpacity.oninput = (e) => {
    const draw = state.drawings.find(d => d.id === state.contextTargetId);
    if (draw) { draw.opacity = e.target.value; renderAll(); }
};

btnConfirmServerPort.onclick = (e) => {
    e.stopPropagation();
    const port = serverAppPortInput.value.trim();
    if (!port) { alert('Please enter a port'); return; }
    
    state.links.push({ 
        id: 'link_' + Date.now(), 
        sourceId: pendingLink.sourceId, 
        sourcePort: pendingLink.sourcePort, 
        targetId: pendingLink.targetId, 
        targetPort: port,
        isServerPort: true 
    });
    
    state.nodes.find(n => n.id === pendingLink.sourceId).usedPorts.push(pendingLink.sourcePort);
    renderLinks();
    portModal.style.display = 'none';
    resetPendingLink();
};

document.getElementById('btn-cancel-port').onclick = () => {
    portModal.style.display = 'none';
    resetPendingLink();
};

document.getElementById('menu-start').onclick = () => { 
    if (state.contextTargetId) updateNodeStatus(state.contextTargetId, 'started'); 
    contextMenu.style.display = 'none'; 
};
document.getElementById('menu-stop').onclick = () => { 
    if (state.contextTargetId) updateNodeStatus(state.contextTargetId, 'stopped'); 
    contextMenu.style.display = 'none'; 
};
document.getElementById('menu-configure').onclick = () => { 
    if (state.contextTargetId) renderProperties(state.contextTargetId); 
    contextMenu.style.display = 'none'; 
};
document.getElementById('menu-delete').onclick = () => {
    state.nodes = state.nodes.filter(n => n.id !== state.contextTargetId);
    state.drawings = state.drawings.filter(d => d.id !== state.contextTargetId);
    state.links = state.links.filter(l => l.sourceId !== state.contextTargetId && l.targetId !== state.contextTargetId);
    renderAll(); 
    renderProperties(null); 
    contextMenu.style.display = 'none';
};

// Initial Render
renderAll();
