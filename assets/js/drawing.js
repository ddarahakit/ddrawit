import { state } from './state.js';
import { drawingLayer, contextMenu, shapeProps, propColor, propOpacity } from './dom.js';
import { hexToRgba } from './utils.js';
import { clearSelections, renderProperties, onMouseMove, onMouseUp } from './ui.js';

export function createDrawing(type, x, y) {
    const drawing = { 
        id: 'draw_' + Date.now(), 
        type: type === 'container' ? 'group' : type, 
        x: x - 100, 
        y: y - 100, 
        w: 200, 
        h: 200, 
        color: '#94a3b8', 
        opacity: 0.1,
        zIndex: state.drawings.length + 1,
        borderStyle: 'solid',
        text: '',
        textAlign: 'center',
        textBaseline: 'middle'
    };
    state.drawings.push(drawing); 
    renderDrawing(drawing);
}

export function renderDrawing(draw) {
    const drawEl = document.createElement('div');
    drawEl.className = `shape ${draw.type}`;
    drawEl.id = draw.id;
    drawEl.style.cssText = `
        left: ${draw.x}px; 
        top: ${draw.y}px; 
        width: ${draw.w}px; 
        height: ${draw.h}px; 
        border-color: ${draw.color}; 
        border-style: ${draw.borderStyle};
        background-color: ${hexToRgba(draw.color, draw.opacity)};
        z-index: ${draw.zIndex};
        display: flex;
        align-items: ${draw.textBaseline === 'middle' ? 'center' : (draw.textBaseline === 'top' ? 'flex-start' : 'flex-end')};
        justify-content: ${draw.textAlign === 'center' ? 'center' : (draw.textAlign === 'left' ? 'flex-start' : 'flex-end')};
    `;

    drawEl.innerHTML = `<div class="shape-text" style="padding: 10px; pointer-events: none; word-break: break-all;">${draw.text}</div>`;

    ['tl', 'tr', 'bl', 'br'].forEach(dir => {
        const handle = document.createElement('div');
        handle.className = `resizer ${dir}`;
        handle.onmousedown = (e) => startResize(e, draw, dir);
        drawEl.appendChild(handle);
    });

    drawEl.addEventListener('mousedown', (e) => {
        if (e.button !== 0 || state.currentTool !== 'select' || e.target.classList.contains('resizer')) return;
        e.stopPropagation();
        state.draggedElement = draw; 
        state.dragType = 'shape';
        state.offset.x = e.clientX / state.zoom - draw.x; 
        state.offset.y = e.clientY / state.zoom - draw.y;
        clearSelections(); 
        drawEl.classList.add('selected');
        renderProperties(draw.id);
        const propertiesTab = document.querySelector('.sidebar-tab[data-tab="properties"]');
        if (propertiesTab) propertiesTab.click();
        document.addEventListener('mousemove', onMouseMove); 
        document.addEventListener('mouseup', onMouseUp);
    });

    drawEl.oncontextmenu = (e) => {
        e.preventDefault(); 
        e.stopPropagation(); 
        state.contextTargetId = draw.id;
        contextMenu.style.display = 'block'; 
        contextMenu.style.left = e.clientX + 'px'; 
        contextMenu.style.top = e.clientY + 'px';
        shapeProps.style.display = 'block';
        propColor.value = draw.color; 
        propOpacity.value = draw.opacity;
    };

    drawingLayer.appendChild(drawEl);
}

function startResize(e, draw, dir) {
    e.stopPropagation();
    state.draggedElement = draw; 
    state.dragType = 'resize'; 
    state.resizeDir = dir;
    state.offset.startX = e.clientX / state.zoom; 
    state.offset.startY = e.clientY / state.zoom;
    state.offset.x = draw.x; 
    state.offset.y = draw.y; 
    state.offset.w = draw.w; 
    state.offset.h = draw.h;
    document.addEventListener('mousemove', onMouseMove); 
    document.addEventListener('mouseup', onMouseUp);
}
