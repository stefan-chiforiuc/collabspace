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
            const r = route() as { page: 'room'; roomCode: string; password?: string; isCreator: boolean };
            return <RoomView roomCode={r.roomCode} password={r.password} isCreator={r.isCreator} />;
          })()}
        </Match>
      </Switch>
      <UpdateToast />
    </>
  );
}
