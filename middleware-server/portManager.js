// portManager.js
class PortManager {
    constructor(startPort = 10000, endPort = 20000) {
      this.startPort = startPort;
      this.endPort = endPort;
      this.usedPorts = new Set();
    }
  
    allocatePort() {
      for (let port = this.startPort; port <= this.endPort; port += 2) {
        if (!this.usedPorts.has(port)) {
          this.usedPorts.add(port);
          return port;
        }
      }
      throw new Error('No ports available');
    }
  
    releasePort(port) {
      this.usedPorts.delete(port);
    }
  }
  
  module.exports = new PortManager();