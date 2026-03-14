export const state = {
    nodes: [],
    links: [],
    drawings: [],
    zoom: 1.0,
    currentTool: 'select',
    isDrawingLink: false,
    selectedSourceId: null,
    draggedElement: null,
    dragType: 'node',
    resizeDir: '',
    offset: { x: 0, y: 0, w: 0, h: 0, startX: 0, startY: 0 },
    contextTargetId: null,
    isSimulating: false,
    simulationLoad: 50, // Default load percentage
    totalRps: 1000,
    nodeMetrics: {} // Stores { nodeId: { rps, cpuUsage, ramUsage } }
};

export const pendingLink = { sourceId: null, targetId: null, sourcePort: null };

export function resetPendingLinkState() {
    pendingLink.sourceId = null;
    pendingLink.targetId = null;
    pendingLink.sourcePort = null;
}
