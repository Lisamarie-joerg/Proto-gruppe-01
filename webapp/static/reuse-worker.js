import {buildPlan} from './reuse-core.js';
self.onmessage=({data})=>{
  try {
    const plan=buildPlan(data.sources,data.settings,(done,total)=>self.postMessage({type:'progress',done,total}));
    self.postMessage({type:'complete',plan});
  } catch(error) {
    self.postMessage({type:'error',message:error.message});
  }
};

