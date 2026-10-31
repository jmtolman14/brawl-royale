import { lazy, Suspense, useEffect } from 'react';
import { toggleLock } from '../game/GameLoop';
import { session, startMatch } from '../game/session';
import { useUi } from '../store/ui';
import { DIFFICULTY_SKILL, useSettings } from '../store/settings';
import { HUD } from './HUD';
import { Tutorial } from './Tutorial';
import { FpsCounter } from './FpsCounter';
import { initAudio, startCrowd, stopCrowd } from '../audio/sfx';
import { installAudio } from '../game/audioBridge';
import { FullMap, PauseMenu, ResultsScreen } from './Overlays';
import { ScreenLabels } from '../render/vfx/ScreenLabels';

const GameCanvas = lazy(() => import('../render/GameCanvas'));

export default function GameScreen() {
  const { fighterId, training, matchKey } = useUi();
  // Create the match synchronously before the canvas mounts
  if (!session.runner || (session.runner as unknown as { key?: number }).key !== matchKey) {
    const botSkill = training ? 0.2 : DIFFICULTY_SKILL[useSettings.getState().difficulty];
    const r = startMatch({ seed: (Date.now() & 0xffff) + (matchKey & 0xffff), playerRoster: fighterId, botCount: training ? 1 : 29, skipBus: training, training, botSkill });
    (r as unknown as { key?: number }).key = matchKey;
  }
  useEffect(() => {
    const ui = useUi.getState();
    session.input.ui = {
      onMap: () => ui.set({ mapOpen: !useUi.getState().mapOpen }),
      onPause: () => {
        const u = useUi.getState();
        if (u.results) return;
        if (u.paused) {
          u.set({ paused: false });
          session.input.requestLock();
        } else u.set({ paused: true });
      },
      onLock: toggleLock,
    };
    initAudio();
    startCrowd();
    const offAudio = installAudio();
    return () => {
      offAudio();
      stopCrowd();
      session.input.detach();
    };
  }, []);
  return (
    <div className="fixed inset-0">
      <Suspense fallback={<div className="grid h-full place-items-center font-display text-4xl">LOADING ISLAND…</div>}>
        <GameCanvas key={matchKey} />
      </Suspense>
      <ScreenLabels />
      <HUD />
      <Tutorial />
      <FpsCounter />
      <FullMap />
      <PauseMenu />
      <ResultsScreen />
    </div>
  );
}
