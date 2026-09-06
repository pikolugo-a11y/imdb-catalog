import NextLink from 'next/link';

/**
 * PikoFilm navigation deliberately disables Next.js automatic route prefetch.
 * The app is a private, database-backed catalogue with many dynamic links per
 * screen; speculative navigation can otherwise fan one real visit out into
 * dozens of unnecessary Vercel requests.
 */
export default function NoPrefetchLink(props){
  return <NextLink {...props} prefetch={false}/>;
}
