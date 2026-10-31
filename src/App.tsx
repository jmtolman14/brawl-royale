import { lazy, Suspense } from 'react';
import MainMenu from './ui/MainMenu';
import { useUi } from './store/ui';

const GameScreen = lazy(() => import('./ui/GameScreen'));
const CharacterSelect = lazy(() => import('./ui/CharacterSelect'));
const HowToPlay = lazy(() => import('./ui/HowToPlay'));
const Settings = lazy(() => import('./ui/Settings'));

function Loading() {
  return <div className="grid h-full place-items-center font-display text-3xl tracking-wider opacity-70">LOADING…</div>;
}

export default function App() {
  const screen = useUi((s) => s.screen);
  return (
    <Suspense fallback={<Loading />}>
      {screen === 'menu' && <MainMenu />}
      {screen === 'select' && <CharacterSelect />}
      {screen === 'howto' && <HowToPlay />}
      {screen === 'settings' && <Settings />}
      {screen === 'game' && <GameScreen />}
    </Suspense>
  );
}
