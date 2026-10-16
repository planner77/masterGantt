import { createRoot } from "react-dom/client";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { Gantt, Willow, type IApi, type ITask } from "@svar-ui/react-gantt";
import "@svar-ui/react-gantt/all.css";
import { GanttAdapterFixture } from "../../../src/features/gantt/diagnostics/gantt-adapter-fixture";
import { createAxisTransaction, type AxisTransactionOptions } from "../../../src/features/gantt/viewport/axis-transaction";
import { createGanttAdapter } from "../../../src/features/gantt/adapter/gantt-adapter";
import type { UserIntentLease } from "../../../src/features/gantt/state-consistency/contracts";

const host = document.getElementById("fixture")!;
const params = new URLSearchParams(location.search);
const scale = params.get("scale") === "week" ? "week" : "day";
const mode = params.get("mode") ?? "U1";
const origin = new Date(2026, 0, 4).getTime();
const initialEnd = new Date(2026, params.get("range") === "short" ? 0 : 6, params.get("range") === "short" ? 18 : 6).getTime();
const columns = [{ id: "text", header: "Synthetic", width: 140 }];
const links: [] = [];
const scales = [{ unit: scale, step: 1, format: "%d %M" }];
const tasks: ITask[] = Array.from({length: 60}, (_, i) => ({ id: `fixture-${i}`, text: `Synthetic ${i}`, parent: 0,
  type: i === 5 ? "milestone" : "task", start: new Date(2026, 0, 5 + i), ...(i === 5 ? {duration: 0} : {end: new Date(2026, 0, 8 + i)}) }));
function TransactionFixture() {
  const root = useRef<HTMLDivElement>(null);
  const api = useRef<IApi | null>(null);
  const [end, setEnd] = useState(initialEnd);
  const [ready, setReady] = useState(false);
  const instances = useRef(0), epoch = useRef(0), extentEpoch = useRef(0), leaseEpoch = useRef(0);
  const waiters = useRef(new Set<() => void>());
  const init = useCallback((value: IApi) => { api.current = value; instances.current++; setReady(true); }, []);
  useLayoutEffect(() => { extentEpoch.current++; for (const done of waiters.current) done(); }, [end]);
  useLayoutEffect(() => {
    if (!ready || !root.current || !api.current) return;
    const element = root.current, value = api.current;
    const adapter = createGanttAdapter({api: value, root: element, installedVersion: "2.7.3", context: () => ({run:"fixture666",head:"synthetic",scenario:"axis",layer:"CORE_PUBLIC_API",apiInstance: instances.current,projectRevision:1,canonicalEpoch:0,projectionEpoch:0,scope:"synthetic",filterKey:"all",scale,intentId:leaseEpoch.current,intentSource:"fixture"}), axis:{origin:()=>new Date(origin),unit:()=>scale,cellWidth:()=>scale === "day" ? 36 : 68}});
    const frame = (signal: AbortSignal) => new Promise<boolean>(resolve => {
      if (signal.aborted) {resolve(false);return;}
      const cancel = () => {cancelAnimationFrame(id); resolve(false);};
      const id = requestAnimationFrame(() => {signal.removeEventListener("abort",cancel); resolve(true);});
      signal.addEventListener("abort", cancel, {once:true});
    });
    let writes = 0, hold = false, release: (() => void) | null = null;
    let pending: Promise<unknown> | null = null;
    const controllers = new Set<AbortController>();
    const sample = () => ({...adapter.sample(),apiInstance:instances.current,writes,leaseEpoch:leaseEpoch.current});
    const invalidate = () => {leaseEpoch.current++;};
    element.addEventListener("wheel",invalidate,{capture:true,passive:true});
    const transactionOptions: AxisTransactionOptions = {
      apiInstance:"synthetic-axis-"+instances.current,
      geometry:{readGeometry(){const read=adapter.readGeometry(); return read.ok ? {ok:true,value:read.value,core:{left:value.getState().scrollLeft,top:value.getState().scrollTop}} : {ok:false,outcome:"NOT_MEASURABLE"};}},
      clock:{now:()=>performance.now(),frame},
      readAxis(){const read=adapter.readCore();return {startMs:read.originMs!,endMs:read.endMs!,scaleWidth:read.scaleWidth!};},
      isLeaseCurrent: lease => lease.stamp.intent === leaseEpoch.current,
      strategy:"EXPLICIT_EXTENT",
      async changeExtent(extent,context){
        if (!context.current()) return false;
        writes++;
        const previous=extentEpoch.current;
        await new Promise<void>(resolve => {
          const cleanup=()=>{waiters.current.delete(finish);context.signal.removeEventListener("abort",cancel);resolve();};
          const finish=()=>{if(extentEpoch.current>previous)cleanup();};
          const cancel=()=>cleanup();
          context.signal.addEventListener("abort",cancel,{once:true});waiters.current.add(finish);setEnd(extent.endMs);
        });
        if (hold && context.current()) await new Promise<void>(resolve => {
          const finish = () => { context.signal.removeEventListener("abort", finish); release = null; delete host.dataset.pending; resolve(); };
          release = finish; context.signal.addEventListener("abort", finish, {once:true}); host.dataset.pending="true";
        });
        return context.current();
      },
      async applyPosition(position,context){if(!context.current())return false;writes++;await value.exec("scroll-chart",position);return context.current();},
    };
    const transaction = createAxisTransaction(transactionOptions);
    const control = {
      sample, settle:adapter.settle,
      async position(position:{left:number;top:number},allowClamp:boolean){
        const controller=new AbortController();controllers.add(controller);
        const before=sample();
        const lease:UserIntentLease={stamp:{context:"synthetic",contextEpoch:epoch.current,gesture:0,intent:leaseEpoch.current},priority:1};
        const result=await transaction.run({extent:{startMs:before.core.originMs!,endMs:before.core.endMs!},policy:{kind:"POSITION",position,allowClamp},lease,abort:{signal:controller.signal,isCurrent:()=>lease.stamp.intent===leaseEpoch.current}});
        const writesAtResult=writes;controllers.delete(controller);await adapter.settle();return {before,result,after:sample(),lateWrites:writes-writesAtResult};
      },
      async syntheticCancel(){
        const controller=new AbortController();controllers.add(controller);
        const before=sample();let syntheticWrites=0,restoringWrites=0;
        const lease:UserIntentLease={stamp:{context:"synthetic",contextEpoch:0,gesture:0,intent:leaseEpoch.current},priority:1};
        const options:AxisTransactionOptions={...transactionOptions,strategy:"SYNTHETIC_COMPATIBILITY",compatibility:{enabled:true,wrapperVersion:"2.7.3",storeVersion:"2.7.2",source:value},async changeExtent(_extent,context){
          if(!context.current())return false;
          const state=value.getState();syntheticWrites++;await value.exec("resize-chart",{width:(state._scales?.width??0)+3276,height:state._chartHeight,scrollSize:state._scrollSize??0});
          controller.abort();
          if(!context.current())return false;
          restoringWrites++;return false;
        }};
        const request={extent:{startMs:origin,endMs:(before.core.endMs??initialEnd)+91*86400000},policy:{kind:"PRESERVE" as const},lease,abort:{signal:controller.signal,isCurrent:()=>true}};
        const trial=createAxisTransaction(options);const result=await trial.run(request);const afterCancel=sample();
        const retry=createAxisTransaction(options);const nextController=new AbortController();
        const retryResult=await retry.run({...request,abort:{signal:nextController.signal,isCurrent:()=>true}});
        element.style.width="90%";await adapter.settle();
        trial.dispose();retry.dispose();controllers.delete(controller);
        return {before,afterCancel,afterNaturalResize:sample(),result,retryResult,syntheticWrites,restoringWrites};
      },
      async scroll(left:number,top:number){await value.exec("scroll-chart",{left,top});return adapter.settle();},
      invalidate,
      async filterNoMatch(){invalidate();await value.exec("filter-tasks",{filter:()=>false});await adapter.settle();return {canonicalCount:(value.serialize() as ITask[]).length,visibleCount:value.getState()._tasks.length};},
      async reveal(id:string){invalidate();await value.exec("select-task",{id,show:"xy"});await adapter.settle();return sample();},
      async resize(){invalidate();element.style.width="75%";await adapter.settle();return sample();},
      async columns(){invalidate();await value.exec("set-columns",{columns:[{id:"text",header:"Synthetic",width:180}]});await value.exec("resize-grid",{width:180});await adapter.settle();return sample();},
      start(){hold=true;pending=control.run();},
      async finish(){hold=false;release?.();const result=await pending;pending=null;return result;},
      dispose(){for(const controller of controllers)controller.abort();release?.();transaction.dispose();adapter.dispose();element.removeEventListener("wheel",invalidate,true);},
      async run(policy:"PRESERVE"|"ORIGIN"|"POSITION"="PRESERVE", interruption="none"){
        const controller=new AbortController();controllers.add(controller);
        const lease:UserIntentLease={stamp:{context:"synthetic",contextEpoch:epoch.current,gesture:0,intent:leaseEpoch.current},priority:1};
        const before=sample();
        const next = new Date(before.core.endMs ?? initialEnd);next.setDate(next.getDate()+91);
        const pending=transaction.run({extent:{startMs:origin,endMs:next.getTime()},policy:policy === "POSITION" ? {kind:"POSITION",position:{left:0,top:0}} : {kind:policy},lease,abort:{signal:controller.signal,isCurrent:()=>lease.stamp.intent===leaseEpoch.current}});
        // Invalidate at the isolated facade boundary; real input is tested through start/finish separately.
        if(interruption !== "none") {await Promise.resolve();await Promise.resolve();}
        if(interruption === "abort")controller.abort();
        if(["wheel","query","reveal","layout"].includes(interruption)){
          if(interruption === "wheel")element.dispatchEvent(new WheelEvent("wheel",{deltaX:37,bubbles:true})); else invalidate();
        }
        const result=await pending;controllers.delete(controller);
        await adapter.settle();
        return {before,result,after:sample(),interruption};
      },
      hidden(hidden:boolean){element.hidden=hidden;invalidate();},
      canonical(){return {tasks:(value.serialize({data:"tasks"}) as ITask[]).map(task=>({id:String(task.id),parent:String(task.parent),type:task.type,startMs:task.start?.getTime()??null,endMs:task.end?.getTime()??null})),tree:(value.serialize({data:"tree"}) as ITask[]).map(task=>({id:String(task.id),parent:String(task.parent)})),links:value.serialize({data:"links"})};},
      tasks(){return (value.serialize() as ITask[]).map(task=>({id:String(task.id),type:task.type,startMs:task.start?.getTime()??null,endMs:task.end?.getTime()??null}));},
    };
    Object.assign(window,{__axis666:control});
    host.dataset.ready="true";
    return ()=>{control.dispose();delete (window as Window & {__axis666?:unknown}).__axis666;};
  },[ready]);
  const variant = params.get("variant");
  const visible = variant === "empty" ? [] : variant === "milestone" ? tasks.filter(task=>task.type === "milestone") : tasks;
  return <div ref={root} style={{height:500}}><Willow><div style={{height:500}}><Gantt init={init} tasks={visible} links={links} readonly autoScale={false}
    start={new Date(origin)} end={new Date(end)} gridWidth={140} columns={columns} scales={scales} cellWidth={scale === "day" ? 36 : 68}/></div></Willow></div>;
}
createRoot(host).render(mode === "U1" ? <TransactionFixture/> : <GanttAdapterFixture mode={mode as "A"|"B"|"C"} scale={scale}/>);
