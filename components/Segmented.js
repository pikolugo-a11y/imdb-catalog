import Link from 'next/link';
export default function Segmented({items,value,className=''}){return <div className={`segmented ${className}`}>{items.map(x=><Link key={x.value} href={x.href} className={String(value||'')===String(x.value)?'active':''}>{x.label}{x.count!=null&&<span>{x.count}</span>}</Link>)}</div>}
