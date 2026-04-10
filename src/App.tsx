import { Switch, Match } from 'solid-js';
import { useHashRouter } from './hooks/useHashRouter';
import Landing from './components/Landing';
import RoomView from './components/RoomView';
import UpdateToast from './components/UpdateToast';

export default function App() {
  const { route } = useHashRouter();

  return (
    <>
      <Switch fallback={<Landing />}>
        <Match when={route().page === 'landing'}>
          <Landing />
        </Match>
        <Match when={route().page === 'room'}>
          {(() => {
            const r = route() as { page: 'room'; roomCode: string; password?: string; isCreator: boolean; sharedTurn?: import('./lib/turn-config').TurnServerConfig[] };
            return <RoomView roomCode={r.roomCode} password={r.password} isCreator={r.isCreator} sharedTurn={r.sharedTurn} />;
          })()}
        </Match>
      </Switch>
      <UpdateToast />
    </>
  );
}
