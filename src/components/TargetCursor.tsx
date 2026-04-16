'use client';

import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';

import {
  DEFAULT_TARGET_CURSOR_SELECTOR,
  shouldDisableTargetCursor,
} from '@/components/target-cursor-utils';

export interface TargetCursorProps {
  targetSelector?: string;
  spinDuration?: number;
  hideDefaultCursor?: boolean;
  hoverDuration?: number;
  parallaxOn?: boolean;
}

const BORDER_WIDTH = 3;
const CORNER_SIZE = 12;
const RELAXED_CORNER_OFFSETS = [
  { x: -CORNER_SIZE * 1.5, y: -CORNER_SIZE * 1.5 },
  { x: CORNER_SIZE * 0.5, y: -CORNER_SIZE * 1.5 },
  { x: CORNER_SIZE * 0.5, y: CORNER_SIZE * 0.5 },
  { x: -CORNER_SIZE * 1.5, y: CORNER_SIZE * 0.5 },
] as const;

function getCornerPositions(rect: DOMRect) {
  return [
    { x: rect.left - BORDER_WIDTH, y: rect.top - BORDER_WIDTH },
    { x: rect.right + BORDER_WIDTH - CORNER_SIZE, y: rect.top - BORDER_WIDTH },
    { x: rect.right + BORDER_WIDTH - CORNER_SIZE, y: rect.bottom + BORDER_WIDTH - CORNER_SIZE },
    { x: rect.left - BORDER_WIDTH, y: rect.bottom + BORDER_WIDTH - CORNER_SIZE },
  ];
}

function resumeSpin(cursor: HTMLDivElement, spinDuration: number, timelineRef: React.MutableRefObject<gsap.core.Timeline | null>) {
  const currentRotation = Number(gsap.getProperty(cursor, 'rotation')) || 0;
  const normalizedRotation = ((currentRotation % 360) + 360) % 360;

  timelineRef.current?.kill();

  gsap.to(cursor, {
    rotation: normalizedRotation + 360,
    duration: spinDuration * (1 - normalizedRotation / 360 || 1),
    ease: 'none',
    overwrite: 'auto',
    onComplete: () => {
      timelineRef.current = gsap
        .timeline({ repeat: -1 })
        .to(cursor, { rotation: '+=360', duration: spinDuration, ease: 'none' });
    },
  });
}

export default function TargetCursor({
  targetSelector = DEFAULT_TARGET_CURSOR_SELECTOR,
  spinDuration = 2,
  hideDefaultCursor = true,
  hoverDuration = 0.2,
  parallaxOn = true,
}: TargetCursorProps) {
  const cursorRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  const spinTimelineRef = useRef<gsap.core.Timeline | null>(null);
  const activeTargetRef = useRef<Element | null>(null);
  const cornerElementsRef = useRef<HTMLDivElement[]>([]);
  const activeTargetRectRef = useRef<DOMRect | null>(null);
  const [isDisabled, setIsDisabled] = useState(true);

  useEffect(() => {
    const syncDisableState = () => {
      setIsDisabled(
        shouldDisableTargetCursor({
          hasTouchScreen: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
          innerWidth: window.innerWidth,
          userAgent: navigator.userAgent || navigator.vendor || '',
        }),
      );
    };

    syncDisableState();
    window.addEventListener('resize', syncDisableState);

    return () => {
      window.removeEventListener('resize', syncDisableState);
    };
  }, []);

  useEffect(() => {
    if (isDisabled || !cursorRef.current) {
      return;
    }

    const cursor = cursorRef.current;
    const dot = dotRef.current;
    const originalCursor = document.body.style.cursor;
    const corners = Array.from(
      cursor.querySelectorAll<HTMLDivElement>('.target-cursor-corner'),
    );
    cornerElementsRef.current = corners;

    if (hideDefaultCursor) {
      document.body.style.cursor = 'none';
    }

    const setRelaxedCorners = () => {
      corners.forEach((corner, index) => {
        const offset = RELAXED_CORNER_OFFSETS[index];

        gsap.to(corner, {
          x: offset.x,
          y: offset.y,
          duration: 0.28,
          ease: 'power3.out',
          overwrite: 'auto',
        });
      });
    };

    const startSpin = () => {
      spinTimelineRef.current?.kill();
      spinTimelineRef.current = gsap
        .timeline({ repeat: -1 })
        .to(cursor, { rotation: '+=360', duration: spinDuration, ease: 'none' });
    };

    const applyTargetFrame = (mouseX: number, mouseY: number) => {
      const rect = activeTargetRectRef.current;

      if (!rect) {
        return;
      }

      const positions = getCornerPositions(rect);

      corners.forEach((corner, index) => {
        const nextX = positions[index].x - mouseX;
        const nextY = positions[index].y - mouseY;

        gsap.to(corner, {
          x: nextX,
          y: nextY,
          duration: parallaxOn ? hoverDuration : 0,
          ease: parallaxOn ? 'power2.out' : 'none',
          overwrite: 'auto',
        });
      });
    };

    const activateTarget = (target: Element, mouseX: number, mouseY: number) => {
      if (activeTargetRef.current === target) {
        activeTargetRectRef.current = target.getBoundingClientRect();
        applyTargetFrame(mouseX, mouseY);
        return;
      }

      activeTargetRef.current = target;
      activeTargetRectRef.current = target.getBoundingClientRect();
      spinTimelineRef.current?.pause();
      gsap.to(cursor, {
        rotation: 0,
        duration: hoverDuration,
        ease: 'power2.out',
        overwrite: 'auto',
      });
      applyTargetFrame(mouseX, mouseY);
    };

    const deactivateTarget = () => {
      if (!activeTargetRef.current) {
        return;
      }

      activeTargetRef.current = null;
      activeTargetRectRef.current = null;
      setRelaxedCorners();
      resumeSpin(cursor, spinDuration, spinTimelineRef);
    };

    const moveCursor = (x: number, y: number) => {
      gsap.to(cursor, {
        x,
        y,
        duration: 0.1,
        ease: 'power3.out',
        overwrite: 'auto',
      });
    };

    gsap.set(cursor, {
      xPercent: -50,
      yPercent: -50,
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });
    setRelaxedCorners();
    startSpin();

    const handleMouseMove = (event: MouseEvent) => {
      moveCursor(event.clientX, event.clientY);

      if (!activeTargetRef.current) {
        return;
      }

      activeTargetRectRef.current = activeTargetRef.current.getBoundingClientRect();
      applyTargetFrame(event.clientX, event.clientY);
    };

    const handleMouseOver = (event: MouseEvent) => {
      const target = (event.target as Element | null)?.closest(targetSelector);

      if (!target) {
        return;
      }

      activateTarget(target, event.clientX, event.clientY);
    };

    const handleMouseOut = (event: MouseEvent) => {
      if (!activeTargetRef.current) {
        return;
      }

      const relatedTarget = event.relatedTarget as Element | null;
      const nextActiveTarget = relatedTarget?.closest(targetSelector) ?? null;

      if (nextActiveTarget === activeTargetRef.current) {
        return;
      }

      deactivateTarget();
    };

    const handleScroll = () => {
      if (!activeTargetRef.current) {
        return;
      }

      const cursorX = Number(gsap.getProperty(cursor, 'x')) || 0;
      const cursorY = Number(gsap.getProperty(cursor, 'y')) || 0;
      const elementUnderCursor = document.elementFromPoint(cursorX, cursorY);

      if (
        !elementUnderCursor ||
        (elementUnderCursor !== activeTargetRef.current &&
          elementUnderCursor.closest(targetSelector) !== activeTargetRef.current)
      ) {
        deactivateTarget();
        return;
      }

      activeTargetRectRef.current = activeTargetRef.current.getBoundingClientRect();
      applyTargetFrame(cursorX, cursorY);
    };

    const handleMouseDown = () => {
      if (dot) {
        gsap.to(dot, { scale: 0.72, duration: 0.18, overwrite: 'auto' });
      }

      gsap.to(cursor, { scale: 0.92, duration: 0.18, overwrite: 'auto' });
    };

    const handleMouseUp = () => {
      if (dot) {
        gsap.to(dot, { scale: 1, duration: 0.18, overwrite: 'auto' });
      }

      gsap.to(cursor, { scale: 1, duration: 0.18, overwrite: 'auto' });
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mouseover', handleMouseOver as EventListener);
    window.addEventListener('mouseout', handleMouseOut as EventListener);
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseover', handleMouseOver as EventListener);
      window.removeEventListener('mouseout', handleMouseOut as EventListener);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      spinTimelineRef.current?.kill();
      document.body.style.cursor = originalCursor;
      activeTargetRef.current = null;
      activeTargetRectRef.current = null;
    };
  }, [hideDefaultCursor, hoverDuration, isDisabled, parallaxOn, spinDuration, targetSelector]);

  if (isDisabled) {
    return null;
  }

  return (
    <div
      ref={cursorRef}
      aria-hidden="true"
      className="fixed left-0 top-0 h-0 w-0 pointer-events-none z-[9999] mix-blend-normal"
      style={{ willChange: 'transform' }}
    >
      <div
        ref={dotRef}
        className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--target-cursor-dot)] shadow-[0_0_16px_var(--target-cursor-glow)]"
        style={{ willChange: 'transform' }}
      />
      <div
        className="target-cursor-corner absolute left-1/2 top-1/2 h-3 w-3 -translate-x-[150%] -translate-y-[150%] border-[3px] border-[var(--target-cursor-stroke)] border-b-0 border-r-0 shadow-[0_0_18px_var(--target-cursor-glow)]"
        style={{ willChange: 'transform' }}
      />
      <div
        className="target-cursor-corner absolute left-1/2 top-1/2 h-3 w-3 translate-x-1/2 -translate-y-[150%] border-[3px] border-[var(--target-cursor-stroke)] border-b-0 border-l-0 shadow-[0_0_18px_var(--target-cursor-glow)]"
        style={{ willChange: 'transform' }}
      />
      <div
        className="target-cursor-corner absolute left-1/2 top-1/2 h-3 w-3 translate-x-1/2 translate-y-1/2 border-[3px] border-[var(--target-cursor-stroke)] border-l-0 border-t-0 shadow-[0_0_18px_var(--target-cursor-glow)]"
        style={{ willChange: 'transform' }}
      />
      <div
        className="target-cursor-corner absolute left-1/2 top-1/2 h-3 w-3 -translate-x-[150%] translate-y-1/2 border-[3px] border-[var(--target-cursor-stroke)] border-r-0 border-t-0 shadow-[0_0_18px_var(--target-cursor-glow)]"
        style={{ willChange: 'transform' }}
      />
    </div>
  );
}
