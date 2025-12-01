/** Generate UUID v4 */
export const generateUuid = () => {
  let d = Date.now() + (performance?.now?.() || 0);

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = ((d + Math.random() * 16) % 16) | 0;
    d = Math.floor(d / 16);

    return c === 'x' ? r.toString(16) : ((r & 0x3) | 0x8).toString(16);
  });
};
