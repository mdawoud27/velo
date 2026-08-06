import os from 'node:os';

const originalNetworkInterfaces = os.networkInterfaces;

os.networkInterfaces = () => {
  const interfaces: NodeJS.Dict<os.NetworkInterfaceInfo[]> = originalNetworkInterfaces();
  for (const name of Object.keys(interfaces)) {
    interfaces[name] = interfaces[name]?.filter((iface) => iface.family === 'IPv4');
  }
  return interfaces;
};
