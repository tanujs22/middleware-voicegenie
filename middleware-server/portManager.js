// portManager.js
class PortManager {
    constructor(startPort = 40000, endPort = 45000) {
      this.startPort = startPort;
      this.endPort = endPort;
      this.usedPorts = new Set();
      console.log(`📊 Port manager initialized with range ${startPort}-${endPort}`);
    }
  
    allocatePort() {
      for (let port = this.startPort; port <= this.endPort; port += 2) {
        if (!this.usedPorts.has(port)) {
          this.usedPorts.add(port);
          console.log(`🔢 Allocated port ${port} (${this.usedPorts.size} ports in use)`);
          return port;
        }
      }
      console.error('⚠️ No ports available in range!');
      throw new Error('No available RTP ports');
    }
  
    releasePort(port) {
      if (this.usedPorts.has(port)) {
        this.usedPorts.delete(port);
        console.log(`🔢 Released port ${port} (${this.usedPorts.size} ports still in use)`);
      } else {
        console.warn(`⚠️ Attempted to release port ${port} which was not allocated`);
      }
    }
  }
  
  module.exports = new PortManager();