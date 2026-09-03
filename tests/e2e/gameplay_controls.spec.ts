import { test, expect } from '@playwright/test';

test.describe('Milestone M4: Genuine Browser Gameplay Controls & Physics E2E Suite', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to local preview server
    await page.goto('/');
    await page.waitForSelector('canvas#game-canvas');
    await page.waitForFunction(() => {
      const w = window as any;
      return w.__GAME__ && w.__GAME__.engine && w.__GAME__.player;
    });

    // Ensure window has focus for real keyboard events
    await page.focus('canvas#game-canvas');
  });

  test('Jump Test (Spacebar): genuine Space keypress causes player upward movement (delta Y < 0) and landing', async ({
    page,
  }) => {
    // 1. Capture initial player grounded state and start Y
    const initial = await page.evaluate(() => {
      const player = (window as any).__GAME__.player;
      return {
        y: player.position.y,
        isGrounded: player.isGrounded,
        vy: player.velocity.y,
      };
    });

    expect(initial.isGrounded).toBe(true);
    const startY = initial.y;

    // 2. Genuine browser Space keypress simulation (dispatches DOM keydown + keyup)
    await page.keyboard.press('Space');

    // 3. Sample physics coordinates across jump ascent phase to capture peak
    let peakY = startY;
    let observedAirborne = false;

    for (let i = 0; i < 20; i++) {
      await page.waitForTimeout(25); // sample every ~25ms over 500ms
      const current = await page.evaluate(() => {
        const p = (window as any).__GAME__.player;
        return { y: p.position.y, isGrounded: p.isGrounded };
      });

      if (current.y < peakY) {
        peakY = current.y;
      }
      if (!current.isGrounded) {
        observedAirborne = true;
      }
    }

    // Mathematical assertion: Canvas Y decreases as player moves upward
    const deltaY = peakY - startY;
    expect(deltaY).toBeLessThan(-20); // Player ascended at least 20px upward
    expect(peakY).toBeLessThan(startY);
    expect(observedAirborne).toBe(true);

    // 4. Verify landing back down on ground platform
    await page.waitForFunction(
      (expectedGroundY) => {
        const p = (window as any).__GAME__?.player;
        return p && p.isGrounded && Math.abs(p.position.y - expectedGroundY) < 2;
      },
      startY,
      { timeout: 3500 }
    );

    const landed = await page.evaluate(() => {
      const p = (window as any).__GAME__.player;
      return {
        y: p.position.y,
        isGrounded: p.isGrounded,
        vy: p.velocity.y,
      };
    });

    expect(landed.isGrounded).toBe(true);
    expect(Math.abs(landed.y - startY)).toBeLessThanOrEqual(2);
    expect(landed.vy).toBe(0);
  });

  test('Jump Test (KeyK): authentic secondary jump key (KeyK) causes player upward movement', async ({
    page,
  }) => {
    const startY = await page.evaluate(() => (window as any).__GAME__.player.position.y);

    await page.keyboard.press('KeyK');

    let peakY = startY;
    for (let i = 0; i < 15; i++) {
      await page.waitForTimeout(30);
      const currentY = await page.evaluate(() => (window as any).__GAME__.player.position.y);
      if (currentY < peakY) {
        peakY = currentY;
      }
    }

    expect(peakY).toBeLessThan(startY - 20);

    // Wait for landing
    await page.waitForFunction(
      (expectedGroundY) => {
        const p = (window as any).__GAME__?.player;
        return p && p.isGrounded && Math.abs(p.position.y - expectedGroundY) < 2;
      },
      startY,
      { timeout: 3500 }
    );
  });

  test('Movement Test (Arrow Keys): ArrowRight and ArrowLeft cause genuine horizontal X displacement', async ({
    page,
  }) => {
    const startX = await page.evaluate(() => (window as any).__GAME__.player.position.x);

    // 1. Move Right: Hold ArrowRight for 300ms
    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(300);
    await page.keyboard.up('ArrowRight');

    const movedRightX = await page.evaluate(() => (window as any).__GAME__.player.position.x);
    // Assert X increased significantly
    expect(movedRightX).toBeGreaterThan(startX + 15);

    // 2. Move Left: Hold ArrowLeft for 300ms
    await page.keyboard.down('ArrowLeft');
    await page.waitForTimeout(300);
    await page.keyboard.up('ArrowLeft');

    const movedLeftX = await page.evaluate(() => (window as any).__GAME__.player.position.x);
    // Assert X moved back to the left
    expect(movedLeftX).toBeLessThan(movedRightX - 15);
  });

  test('Movement Test (WASD Keys): KeyD and KeyA cause genuine horizontal X displacement', async ({
    page,
  }) => {
    const startX = await page.evaluate(() => (window as any).__GAME__.player.position.x);

    // 1. Move Right with KeyD
    await page.keyboard.down('KeyD');
    await page.waitForTimeout(250);
    await page.keyboard.up('KeyD');

    const movedRightX = await page.evaluate(() => (window as any).__GAME__.player.position.x);
    expect(movedRightX).toBeGreaterThan(startX + 15);

    // 2. Move Left with KeyA
    await page.keyboard.down('KeyA');
    await page.waitForTimeout(250);
    await page.keyboard.up('KeyA');

    const movedLeftX = await page.evaluate(() => (window as any).__GAME__.player.position.x);
    expect(movedLeftX).toBeLessThan(movedRightX - 15);
  });

  test('Combined Air Mobility: moving right while jumping produces 2D parabolic displacement', async ({
    page,
  }) => {
    const initial = await page.evaluate(() => {
      const p = (window as any).__GAME__.player;
      return { x: p.position.x, y: p.position.y };
    });

    // Press jump and hold right simultaneously
    await page.keyboard.press('Space');
    await page.keyboard.down('ArrowRight');

    // Sample mid-air trajectory
    await page.waitForTimeout(250);
    const midAir = await page.evaluate(() => {
      const p = (window as any).__GAME__.player;
      return { x: p.position.x, y: p.position.y, isGrounded: p.isGrounded };
    });

    await page.keyboard.up('ArrowRight');

    // Both X must have advanced and Y must have moved upward
    expect(midAir.y).toBeLessThan(initial.y - 15);
    expect(midAir.x).toBeGreaterThan(initial.x + 15);
    expect(midAir.isGrounded).toBe(false);

    // Land back down safely
    await page.waitForFunction(
      (groundY) => {
        const p = (window as any).__GAME__?.player;
        return p && p.isGrounded && Math.abs(p.position.y - groundY) < 2;
      },
      initial.y,
      { timeout: 3500 }
    );
  });
});
