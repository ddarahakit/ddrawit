export function getInitialPorts(type) {
    const ports = { 
        router: ['eth0', 'eth1', 'eth2', 'eth3'], 
        switch: Array.from({length: 8}, (_, i) => `p${i+1}`), 
        server: ['eth0'], 
        loadbalancer: ['eth0', 'eth1'],
        pc: ['eth0'], 
        cloud: ['link'] 
    };
    return ports[type] || ['link'];
}

export function getIconClass(type) {
    const icons = { 
        router: 'fa-solid fa-route', 
        switch: 'fa-solid fa-network-wired', 
        server: 'fa-solid fa-server', 
        loadbalancer: 'fa-solid fa-bridge',
        pc: 'fa-solid fa-desktop', 
        cloud: 'fa-solid fa-cloud' 
    };
    return icons[type] || 'fa-solid fa-microchip';
}

export function hexToRgba(hex, opacity) {
    const r = parseInt(hex.slice(1, 3), 16), 
          g = parseInt(hex.slice(3, 5), 16), 
          b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}
