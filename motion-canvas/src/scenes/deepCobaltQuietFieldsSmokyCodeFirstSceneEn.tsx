import {buildCodeFirstScene} from './_codeFirstShared';

// Theme · DEEP COBALT QUIET FIELDS · SMOKY.
// «Дорогой» вариант через restraint: KEY и METHOD теряют
// насыщенность, остаются в той же светлоте. Это эстетика
// tailored fabric — Brunello Cucinelli, Tom Ford: цвет есть, но
// он шепчет. В отличие от Dusted-варианта (всё пыльное), здесь
// приглушены ТОЛЬКО KEY и METHOD — STRING и ACCENT остаются
// яркими, что создаёт «дорогой контраст»: сдержанный костюм с
// одним заметным аксессуаром.
//   BG       #111722  unchanged
//   INK      #E7E1D6  warm bone (unchanged)
//   KEY      #A893C0  smoky muted violet — было #C7A4EE
//   METHOD   #6FA0BC  slate-blue dusty — было #86C0EA
//   STRING   #A7C992  sage (unchanged)
//   PROP     #D3BD9C  champagne (unchanged)
//   PUNC     #CBD1DC  cool cream (unchanged)
//   OPERATOR #8F9AAA  cool grey (unchanged)
//   ACCENT   #E8C656  mustard (unchanged)

export default buildCodeFirstScene({
    BG:       '#111722',
    INK:      '#E7E1D6',
    KEY:      '#A893C0',
    METHOD:   '#6FA0BC',
    STRING:   '#A7C992',
    PROP:     '#D3BD9C',
    PARAM:    '#E7E1D6',
    PUNC:     '#CBD1DC',
    OPERATOR: '#8F9AAA',
    QUIET:    'rgba(231, 225, 214, 0.50)',
    ACCENT:   '#E8C656',
});
