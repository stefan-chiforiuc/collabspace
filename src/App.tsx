import { Switch, Match } from 'solid-js';
import { useHashRouter } from './hooks/useHashRouter';
import Landing from './components/Landing';
import Lobby from './components/Lobby';
import RoomView from './components/RoomView';
import UpdateToast from './components/UpdateToast';
import type { TurnServerConfig } from './lib/turn-config';

export default function App() {
  const { route } = useHashRouter();

  return (
    <>
      <Switch fallback={<Landing />}>
        <Match when={route().page === 'landing'}>
          <Landing />
        </Match>
        <Match when={route().page === 'lobby'}>
          {(() => {
            const r = route() as { page: 'lobby'; roomCode: string; sharedTurn?: TurnServerConfig[] };
            return <Lobby roomCode={r.roomCode} sharedTurn={r.sharedTurn} />;
          })()}
        </Match>
        <Match when={route().page === 'room'}>
          {(() => {
            const r = route() as { page: 'room'; roomCode: string; password: string; isCreator: boolean; sharedTurn?: TurnServerConfig[] };
            return <RoomView roomCode={r.roomCode} password={r.password} isCreator={r.isCreator} sharedTurn={r.sharedTurn} />;
          })()}
        </Match>
      </Switch>
      <UpdateToast />
    </>
  );
}
