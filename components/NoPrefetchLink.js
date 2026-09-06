import NextLink from 'next/link';

/**
 * PikoFilm navigation deliberately disables Next.js automatic route prefetch.
 * The app is a private, database-backed catalogue with many dynamic links per
 * screen; speculative navigation can otherwise fan one real visit out into
 * dozens of unnecessary Vercel requests. Internal links are also nofollow so
 * cooperative crawlers do not expand the private catalogue graph.
 */
export default function NoPrefetchLink({rel,...props}){
  const safeRel=rel?`${rel} nofollow`:'nofollow';
  return <NextLink {...props} rel={safeRel} prefetch={false}/>;
}
