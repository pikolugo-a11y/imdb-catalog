import NextLink from 'next/link';

/**
 * PikoFilm navigation deliberately disables Next.js automatic route prefetch.
 * The app is a private, database-backed catalogue with many dynamic links per
 * screen; speculative navigation can otherwise fan one real visit out into
 * dozens of unnecessary Vercel requests. Internal links are also nofollow so
 * cooperative crawlers do not expand the private catalogue graph.
 *
 * A missing or explicitly disabled destination must never masquerade as an
 * interactive link: render it as non-interactive text so mouse, keyboard and
 * assistive technology agree across every paginator.
 */
export default function NoPrefetchLink({rel,href,className,...props}){
  const disabledToken=String(className||'').split(/\s+/).includes('disabled');
  const explicitlyDisabled=props['aria-disabled']===true||props['aria-disabled']==='true';
  if(!href||href==='#'||disabledToken||explicitlyDisabled){
    const {target,onClick,...spanProps}=props;
    return <span {...spanProps} className={className} aria-disabled="true"/>;
  }
  const safeRel=rel?`${rel} nofollow`:'nofollow';
  return <NextLink {...props} className={className} href={href} rel={safeRel} prefetch={false}/>;
}
