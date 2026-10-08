import { _electron } from 'playwright'
import path from 'node:path'
const app=await _electron.launch({executablePath:path.resolve('release/win-unpacked/LocalMD.exe'),args:[path.resolve('samples/welcome.md')],env:{...process.env,LOCALMD_USER_DATA:path.resolve('.test-data/diagnose-'+Date.now())}})
const page=await app.firstWindow();page.on('console',message=>console.log('console',message.type(),message.text()));page.on('pageerror',error=>console.log('pageerror',String(error)));page.on('requestfailed',request=>console.log('requestfailed',request.url(),request.failure()));
await page.waitForTimeout(8000);console.log('frames',page.frames().map(f=>f.url()));console.log('body',(await page.locator('body').innerText()).slice(0,5000));await page.screenshot({path:'.test-data/diagnostic.png'});await app.close()
