import './style.css'
import { createApp } from './ui/app'

const host = document.querySelector<HTMLDivElement>('#app')
if (host === null) {
  throw new Error('В index.html нет элемента #app — монтировать некуда')
}

createApp(host).start()
