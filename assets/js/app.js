import { state, pendingLink } from './state.js';
import { 
    workspace, canvasWrapper, nodeLayer, drawingLayer, 
    contextMenu, shapeProps, propColor, propOpacity, 
    portModal, serverAppPortInput, btnConfirmServerPort,
    btnLinkTool, toolButtons, zoomLabel
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

document.getElementById('btn-save').onclick = () => {
    localStorage.setItem('varch_designer_save', JSON.stringify({ nodes: state.nodes, links: state.links, drawings: state.drawings }));
    alert('Project saved!');
};

document.getElementById('btn-load').onclick = () => {
    const data = JSON.parse(localStorage.getItem('varch_designer_save'));
    if (data) { 
        state.nodes = data.nodes || []; 
        state.links = data.links || []; 
        state.drawings = data.drawings || []; 
        renderAll(); 
    }
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
