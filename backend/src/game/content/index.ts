import { validateContent } from '../rules/engine';
import { Content, CONTENT_VERSION } from '../rules/types';
import { BOARD_SPACES } from './board';
import { CARDS } from './cards';

/** The one and only content catalog for mini-v1: "central-castle@1". */
export const CONTENT: Content = {
  version: CONTENT_VERSION,
  spaces: BOARD_SPACES,
  cards: CARDS,
};

// Fail fast at startup if the catalog is broken.
validateContent(CONTENT);
