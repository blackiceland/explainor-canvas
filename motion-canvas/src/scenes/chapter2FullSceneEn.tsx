import {chapter2Full} from './chapter2FullShared';

// Вся глава 2 одной сценой — чистый близнец chapter2FullSubsSceneEn
// без субтитров; таймлайн идентичен покадрово (суб-вызовы стоят те же
// фиксированные доли секунды в обеих версиях).
export default chapter2Full(false);
