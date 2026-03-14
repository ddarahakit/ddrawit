import { state, pendingLink } from './state.js';
import { svgLinkLayer, svgLabelLayer, portModal, portModalTitle, portList, serverPortInputWrap, serverAppPortInput } from './dom.js';
import { resetPendingLink } from './ui.js';

export function handleLinkInteraction(nodeId, mouseX, mouseY) {
    const node = state.nodes.find(n => n.id === nodeId);
    if (!node) return;

    if (!pendingLink.sourceId) {
        // If the first selected device is a server, automatically select eth0.
        if (node.type === 'server') {
            pendingLink.sourceId = nodeId;
            pendingLink.sourcePort = 'eth0';
            document.getElementById(nodeId).classList.add('selected');
        } else {
            showPortSelection(nodeId, mouseX, mouseY, (port) => { 
                pendingLink.sourceId = nodeId; 
                pendingLink.sourcePort = port; 
                document.getElementById(nodeId).classList.add('selected'); 
            });
        }
    } else {
        if (pendingLink.sourceId === nodeId) return;
        
        // If the second selected device is a server, show destination port input.
        if (node.type === 'server') {
            pendingLink.targetId = nodeId;
            renderLinks(); // Lock line to target node
            showServerPortInput(mouseX, mouseY);
        } else {
            showPortSelection(nodeId, mouseX, mouseY, (port) => {
                state.links.push({ 
                    id: 'link_' + Date.now(), 
                    sourceId: pendingLink.sourceId, 
                    sourcePort: pendingLink.sourcePort, 
                    targetId: nodeId, 
                    targetPort: port 
                });
                state.nodes.find(n => n.id === pendingLink.sourceId).usedPorts.push(pendingLink.sourcePort);
                state.nodes.find(n => n.id === nodeId).usedPorts.push(port);
                renderLinks(); 
                resetPendingLink();
            });
        }
    }
}

export function showPortSelection(nodeId, x, y, callback) {
    const node = state.nodes.find(n => n.id === nodeId);
    if (!node) return;
    
    portModalTitle.textContent = 'Select Port';
    portList.style.display = 'grid';
    serverPortInputWrap.style.display = 'none';
    
    portList.innerHTML = '';
    node.ports.forEach(port => {
        const isUsed = node.usedPorts.includes(port);
        const item = document.createElement('div');
        item.className = 'port-item' + (isUsed ? ' disabled' : '');
        item.textContent = port;
        if (!isUsed) item.onclick = (e) => { 
            e.stopPropagation(); 
            portModal.style.display = 'none'; 
            callback(port); 
        };
        portList.appendChild(item);
    });
    portModal.style.display = 'flex'; 
    portModal.style.left = (x + 10) + 'px'; 
    portModal.style.top = (y + 10) + 'px';
}

export function showServerPortInput(x, y) {
    portModalTitle.textContent = 'Enter Server Port';
    portList.style.display = 'none';
    serverPortInputWrap.style.display = 'block';
    serverAppPortInput.value = '';
    
    portModal.style.display = 'flex'; 
    portModal.style.left = (x + 10) + 'px'; 
    portModal.style.top = (y + 10) + 'px';
    serverAppPortInput.focus();
}

export function renderLinks(tempX = null, tempY = null) {
    svgLinkLayer.innerHTML = ''; 
    svgLabelLayer.innerHTML = '';
    state.links.forEach(link => {
        const s = state.nodes.find(n => n.id === link.sourceId), 
              t = state.nodes.find(n => n.id === link.targetId);
        if (s && t) {
            const x1 = s.x + 50, y1 = s.y + 42, x2 = t.x + 50, y2 = t.y + 42;
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', x1); line.setAttribute('y1', y1); 
            line.setAttribute('x2', x2); line.setAttribute('y2', y2);
            line.setAttribute('stroke', '#94a3b8'); 
            line.setAttribute('stroke-width', '2'); 
            line.setAttribute('stroke-dasharray', '4');
            svgLinkLayer.appendChild(line);
            
            addPortLabel(x1, y1, x2, y2, link.sourcePort, 'start'); 
            const labelColor = link.isServerPort ? '#2563eb' : '#334155';
            addPortLabel(x2, y2, x1, y1, link.targetPort, 'end', labelColor);
        }
    });

    // Draw pending link line if source is selected
    if (pendingLink.sourceId) {
        const s = state.nodes.find(n => n.id === pendingLink.sourceId);
        if (s) {
            const x1 = s.x + 50, y1 = s.y + 42;
            let x2 = tempX, y2 = tempY;

            // If target is already selected (e.g., showing server port modal), lock to target
            if (pendingLink.targetId) {
                const t = state.nodes.find(n => n.id === pendingLink.targetId);
                if (t) {
                    x2 = t.x + 50;
                    y2 = t.y + 42;
                }
            }

            if (x2 !== null && y2 !== null) {
                const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                line.setAttribute('x1', x1); line.setAttribute('y1', y1); 
                line.setAttribute('x2', x2); line.setAttribute('y2', y2);
                line.setAttribute('stroke', '#3b82f6'); // Blue for pending
                line.setAttribute('stroke-width', '2'); 
                line.setAttribute('stroke-dasharray', '4');
                svgLinkLayer.appendChild(line);
            }
        }
    }
}

function addPortLabel(x1, y1, x2, y2, text, position, color = '#334155') {
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('class', 'port-label');
    label.style.fill = color;
    
    const dx = x2 - x1, dy = y2 - y1, distance = Math.sqrt(dx*dx + dy*dy), offset = 40;
    if (distance > offset) {
        const lx = x1 + (dx / distance) * offset, ly = y1 + (dy / distance) * offset;
        label.setAttribute('x', lx); label.setAttribute('y', ly); label.setAttribute('text-anchor', 'middle');
        label.textContent = text; 
        svgLabelLayer.appendChild(label);
    }
}
