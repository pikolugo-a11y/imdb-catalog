import NovedadesPlexShell from './NovedadesPlexShell';
import PlexIntake from './PlexIntake';
import './plex-intake.css';

export default function Layout({children}){
  const intake=<PlexIntake/>;
  return <NovedadesPlexShell intake={intake}>{children}</NovedadesPlexShell>;
}
