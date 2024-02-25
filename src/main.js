import './assets/sass/main.scss'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'

if(new URL(location.href).searchParams.get('log') != 1) window.console.log = function() {};

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')
