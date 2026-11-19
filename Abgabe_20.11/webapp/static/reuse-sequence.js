const clamp=value=>Math.max(0,Math.min(1,value));
export function prepareSequence(plan) {
  const removalRank=new Map(plan.removal.map((id,i)=>[id,i]));
  const loadingRank=new Map(plan.loading.map((id,i)=>[id,i]));
  const removalWindow=Math.max(1,plan.removal.length*.04);
  return value=>{
    const t=Math.max(0,Math.min(1000,Number(value)||0));
    const phase=t>=1000?'results':t<=500?'disassembly':'loading';
    const removalCursor=t/500*(plan.removal.length+removalWindow);
    const loadingCursor=(t-500)/500*(plan.loading.length+1);
    const removed=new Set(),loaded=new Set();
    const removalProgress=id=>clamp((removalCursor-(removalRank.get(id)??Infinity))/removalWindow);
    const loadingProgress=id=>clamp(loadingCursor-(loadingRank.get(id)??Infinity));
    for(const id of plan.removal)if(phase!=='disassembly'||removalProgress(id)>=1)removed.add(id);
    for(const id of plan.loading)if(phase==='results'||phase==='loading'&&loadingProgress(id)>=1)loaded.add(id);
    const currentId=phase==='disassembly'?plan.removal[Math.min(plan.removal.length-1,Math.max(0,Math.floor(removalCursor)))]:plan.loading[Math.min(plan.loading.length-1,Math.max(0,Math.floor(loadingCursor)))];
    const current=plan.parts.find(p=>p.id===currentId);
    return {phase,value:t,removed,loaded,current,removalProgress,loadingProgress};
  };
}
