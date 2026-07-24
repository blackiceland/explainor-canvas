import {chapter2Full} from './chapter2FullShared';

// Вся глава 2 одной сценой в монтажном порядке (титул → replay-A →
// живой путь → replay-C/D/E → тейк границы → финальный прогон),
// с вшитыми английскими VO-субтитрами. Близнец без субтитров:
// chapter2FullSceneEn (таймлайн идентичен покадрово).
export default chapter2Full(true);
