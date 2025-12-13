import { createSSRApp } from "vue";
// 修正点：从 'pinia' 中直接解构出 createPinia，不要用 * as Pinia
import { createPinia } from 'pinia'; 
import App from "./App.vue";

export function createApp() {
  const app = createSSRApp(App);
  
  // 创建 Pinia 实例
  const store = createPinia();
  
  // 挂载到 App
  app.use(store);
  
  return {
    app,
    Pinia: store, // 这里的导出是为了兼容 Uni-app 的内部机制
  };
}