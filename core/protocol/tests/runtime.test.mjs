import assert from 'node:assert/strict';
import test from 'node:test';
import { PROTOCOL_VERSION, STUDIO_COMMAND_PROFILE_VERSION } from '@aether/protocol';

test('the packaged module exposes the generated wire version at runtime', () => {
  assert.equal(PROTOCOL_VERSION, 1);
  assert.equal(STUDIO_COMMAND_PROFILE_VERSION, 1);
});
