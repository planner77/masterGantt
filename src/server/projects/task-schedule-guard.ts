/** Summary schedule absence is valid; every real leaf must still have its complete schedule. */
export function hasTaskSchedule<T extends {start:string|null;end:string|null;duration:number|null;progress:number|null}>(task:T): task is T & {start:string;end:string;duration:number;progress:number} {
  return task.start !== null && task.end !== null && task.duration !== null && task.progress !== null;
}
