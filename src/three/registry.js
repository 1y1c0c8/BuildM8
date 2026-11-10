/** 非 React 狀態的共享參考：場景物件、TransformControls 實例、投放函式 */
export const registry = {
  objects: new Map(), // uid → THREE.Group
  transform: null, // TransformControls 實例
  dragging: false,
  lastDragEnd: 0,
  dropAt: null, // (clientX, clientY, rect) => [x,y,z] mm
  controls: null, // OrbitControls
  joints: new Map(), // `${uid}:${jointId}` → 關節樞紐 THREE.Group（世界座標的軸心 / 軸向）
  liveJoints: new Map(), // uid → 拖曳中的暫時關節值（腳輪自動轉向 / 滾動），放開後寫回 store
  jointDrag: null, // { uid, id } 正在畫布上拖曳的關節
  startJointDrag: null, // (uid, joint, event) => void
}
