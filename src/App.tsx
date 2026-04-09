import { Switch, Match } from 'solid-js';
import { useHashRouter } from './hooks/useHashRouter';
import Landing from './components/Landing';
import RoomView from './components/RoomView';

export default function App() {
  const { route } = useHashRouter();

  return (
    <Switch fallback={<Landing />}>
      <Match when={route().page === 'landing'}>
        <Landing />
      </Match>
      <Match when={route().page === 'room'}>
        {(() => {
          const r = route() as { page: 'room'; roomCode: string; password?: string };
          return <RoomView roomCode={r.roomCode} password={r.password} />;
        })()}
      </Match>
    </Switch>
  );
}
