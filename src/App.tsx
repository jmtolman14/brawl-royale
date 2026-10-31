import { lazy, Suspense } from 'react';
import { useUi } from './store/ui';

const GameScreen = lazy(() => import('./ui/GameScreen'));

export default function App() {
  const screen = useUi((s) => s.screen);
  const set = useUi((s) => s.set);
  if (screen === 'game')
    return (
      <Suspense fallback={null}>
        <GameScreen />
      </Suspense>
    );
  return (
    <div className="grid h-full place-items-center">
      <button className="rounded bg-red-600 px-8 py-4 font-display text-4xl" onClick={() => set({ screen: 'game', training: true })}>
        PLAY
      </button>
    </div>
  );
}
