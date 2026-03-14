import { state, pendingLink } from './state.js';
import { svgLinkLayer, svgLabelLayer, portModal, portModalTitle, portList, serverPortInputWrap, serverAppPortInput } from './dom.js';
import { resetPendingLink } from './ui.js';

export function handleLinkInteraction(nodeId, mouseX, mouseY) {
    const node = state.nodes.find(n => n.id === nodeId);
    if (!node) return;

    if (!pendingLink.sourceId) {
        // If the first selected device is a server or LB, automatically select eth0.
        if (node.type === 'server' || node.type === 'loadbalancer') {
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
        
        // If the second selected device is a server or LB, show destination port input.
        if (node.type === 'server' || node.type === 'loadbalancer') {
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

    // Calculate Traffic Distribution if simulating
    const linkLoads = new Map();
    if (state.isSimulating) {
        state.nodeMetrics = {}; // Reset metrics
        const nodeIncomingLoad = {}; // Cumulative percentage reaching each node
        const processedNodes = new Set();
        
        // 1. Identify starting nodes (PC, Cloud, or nodes with no incoming links)
        const allTargetIds = new Set(state.links.map(l => l.targetId));
        const startNodes = state.nodes.filter(n => !allTargetIds.has(n.id));
        
        // Initialize start nodes with 100% load
        startNodes.forEach(n => { nodeIncomingLoad[n.id] = 100; });

        // 2. Propagate load using a BFS-like approach
        const queue = [...startNodes];
        
        while (queue.length > 0) {
            const currentNode = queue.shift();
            const currentLoadPercent = nodeIncomingLoad[currentNode.id] || 0;
            const nodeRps = (state.totalRps * currentLoadPercent) / 100;

            // Calculate Metrics for the current node (Server or LB)
            if (currentNode.type === 'server' || currentNode.type === 'loadbalancer') {
                const cpuCapacity = (currentNode.cpu || 1) * 200; // 200 RPS per core
                const ramCapacity = (currentNode.ram || 1) * 100; // 100 RPS per GB
                state.nodeMetrics[currentNode.id] = {
                    rps: Math.round(nodeRps),
                    cpuUsage: Math.min(100, Math.round((nodeRps / cpuCapacity) * 100)),
                    ramUsage: Math.min(100, Math.round((nodeRps / ramCapacity) * 100))
                };
            }
            
            // Find all links outgoing from this node
            const outgoingLinks = state.links.filter(l => l.sourceId === currentNode.id);
            
            if (outgoingLinks.length > 0) {
                const distributedPercent = currentLoadPercent / outgoingLinks.length;
                
                outgoingLinks.forEach(link => {
                    linkLoads.set(link.id, Math.round(distributedPercent));
                    
                    if (!nodeIncomingLoad[link.targetId]) nodeIncomingLoad[link.targetId] = 0;
                    nodeIncomingLoad[link.targetId] += distributedPercent;
                    
                    if (!processedNodes.has(link.targetId)) {
                        const targetNode = state.nodes.find(n => n.id === link.targetId);
                        if (targetNode && !queue.includes(targetNode)) {
                            queue.push(targetNode);
                        }
                    }
                });
            }
            processedNodes.add(currentNode.id);
        }
    }

    state.links.forEach(link => {
        const s = state.nodes.find(n => n.id === link.sourceId), 
              t = state.nodes.find(n => n.id === link.targetId);
        if (s && t) {
            const x1 = s.x + 50, y1 = s.y + 42, x2 = t.x + 50, y2 = t.y + 42;
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', x1); line.setAttribute('y1', y1); 
            line.setAttribute('x2', x2); line.setAttribute('y2', y2);
            
            // Simulation Load Styling
            let strokeColor = '#94a3b8';
            let particleColor = 'white';

            if (state.isSimulating) {
                const targetMetrics = state.nodeMetrics[link.targetId];
                
                if (targetMetrics) {
                    const maxUsage = Math.max(targetMetrics.cpuUsage, targetMetrics.ramUsage);
                    
                    if (maxUsage >= 70) {
                        strokeColor = '#ef4444'; // Red for overloaded target
                        particleColor = '#ef4444'; // Red particles
                    } else if (maxUsage >= 40) {
                        strokeColor = '#f59e0b'; // Amber for medium load
                        particleColor = 'white';
                    } else {
                        strokeColor = '#22c55e'; // Green for healthy load
                        particleColor = 'white';
                    }
                } else {
                    // Default simulation color for links to non-resource nodes (Switch, etc)
                    strokeColor = '#3b82f6';
                    particleColor = 'white';
                }
                
                line.setAttribute('class', 'simulating-link');
                line.style.strokeDasharray = '8 4';
                const load = state.simulationLoad;
                line.style.animation = `dash-flow ${Math.max(0.1, 2 - (load/50))}s linear infinite`;

                // Add Traffic Percentage Label in the middle
                const midX = (x1 + x2) / 2;
                const midY = (y1 + y2) / 2;
                const loadPercent = linkLoads.get(link.id) || 0;
                addTrafficLabel(midX, midY, `${loadPercent}%`);
            } else {
                line.setAttribute('stroke-dasharray', '4');
            }
            
            line.setAttribute('stroke', strokeColor); 
            line.setAttribute('stroke-width', state.isSimulating ? '3' : '2'); 
            svgLinkLayer.appendChild(line);

            // Add Moving Load Particles
            if (state.isSimulating) {
                const particle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                particle.setAttribute('r', '4');
                particle.setAttribute('fill', particleColor);
                particle.setAttribute('class', 'load-particle');
                
                const duration = Math.max(0.5, 3 - (state.simulationLoad / 33));
                particle.style.offsetPath = `path('M ${x1} ${y1} L ${x2} ${y2}')`;
                particle.style.animation = `particle-flow ${duration}s linear infinite`;
                
                svgLinkLayer.appendChild(particle);
            }
            
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

function addTrafficLabel(x, y, text) {
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('class', 'traffic-label');
    label.setAttribute('x', x);
    label.setAttribute('y', y);
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('dominant-baseline', 'middle');
    label.textContent = text;
    svgLabelLayer.appendChild(label);
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
