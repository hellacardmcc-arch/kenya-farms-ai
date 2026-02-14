/** LOGIC - Handlers for exact preview */

export function togglePump(devices, setDevices, id) {
  setDevices((prev) =>
    prev.map((d) =>
      d.id === id && d.name === 'Irrigation Pump'
        ? { ...d, value: d.value === 'OFF' ? 'ON' : 'OFF', status: d.value === 'OFF' ? 'active' : 'idle' }
        : d
    )
  );
}
