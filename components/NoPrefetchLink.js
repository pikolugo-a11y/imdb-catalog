import NextLink from 'next/link';

/**
 * PikoFilm navigation deliberately disables Next.js automatic route prefetch.
 * The app is a private, database-backed catalogue with many dynamic links per
 * screen; speculative navigation can otherwise fan one real visit out into
 * dozens of unnecessary Vercel requests. Internal links are also nofollow so
 * cooperative crawlers do not expand the private catalogue graph.
 *
 * A missing destination must never masquerade as a link to "#": render it as
 * non-interactive text so mouse, keyboard and assistive technology agree.
 */
export default function NoPrefetchLink({rel,href,...props}){
  if(!href||href==='#'){
    const {target,onClick,...spanProps}=props;
    return <span {...spanProps} aria-disabled="true"/>;
  }
  const safeRel=rel?`${rel} nofollow`:'nofollow';
  return <NextLink {...props} href={href} rel={safeRel} prefetch={false}/>;
}
