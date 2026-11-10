/** 非 React 狀態的共享參考：場景物件、TransformControls 實例、投放函式 */
export const registry = {
  objects: new Map(), // uid → THREE.Group
  transform: null, // TransformControls 實例
  dragging: false,
  lastDragEnd: 0,
  dropAt: null, // (clientX, clientY, rect) => [x,y,z] mm
  controls: null, // OrbitControls
  captureTarget: null, // { gl, scene, camera }，截圖用（capture.js）
}
