/** Stable binary min-heap for bounded A*. Internal use; npm test exercises routing.
 * Sequence numbers resolve equal priorities deterministically; empty pop returns undefined.
 */
export class MinHeap<T> {
  private entries: {value:T;priority:number;sequence:number}[]=[];
  private sequence=0;
  get size():number{return this.entries.length;}
  push(value:T,priority:number):void{
    const entry={value,priority,sequence:this.sequence++};let i=this.entries.length;this.entries.push(entry);
    while(i>0){const parent=(i-1)>>1;if(!this.before(entry,this.entries[parent]!))break;this.entries[i]=this.entries[parent]!;i=parent;}this.entries[i]=entry;
  }
  pop():T|undefined{
    const root=this.entries[0],last=this.entries.pop();if(!root)return;
    if(this.entries.length && last){let i=0;while(true){let child=i*2+1;if(child>=this.entries.length)break;if(child+1<this.entries.length && this.before(this.entries[child+1]!,this.entries[child]!))child++;
      if(!this.before(this.entries[child]!,last))break;this.entries[i]=this.entries[child]!;i=child;}this.entries[i]=last;}
    return root.value;
  }
  private before(a:{priority:number;sequence:number},b:{priority:number;sequence:number}):boolean{return a.priority<b.priority || (a.priority===b.priority && a.sequence<b.sequence);}
}
