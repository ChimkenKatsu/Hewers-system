// Android's origin-restricted WebMessage listener provides the native save dialog.
// Browsers keep their normal download behavior.
export function downloadText(text:string,name:string,mime='text/plain'){
 const bridge=(window as Window&{HewersDownloads?:{postMessage:(value:string)=>void}}).HewersDownloads;
 if(bridge){bridge.postMessage(JSON.stringify({text,name}));return;}
 const url=URL.createObjectURL(new Blob([text],{type:mime}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
