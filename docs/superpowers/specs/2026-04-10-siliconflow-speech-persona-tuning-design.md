# SiliconFlow Speech Persona Tuning Design

Date: 2026-04-10

## Goal

On top of the existing SiliconFlow speech integration, improve how each game persona sounds without changing the frontend contract or introducing custom reference voices.

This round optimizes:

- persona-to-voice mapping
- persona-specific phrasing before TTS
- light emotion-aware `speed` / `gain` tuning

This round explicitly does not include:

- custom uploaded reference voices
- realtime streaming voice conversation redesign
- changes to route response shapes

## Current State

The project already has:

- Volcengine Ark for text generation
- SiliconFlow for TTS and ASR
- a stable server-side adapter layer
- a working `voiceId -> SiliconFlow preset voice` compatibility layer

Current speech output is functionally correct, but persona differentiation is still coarse:

- mapping mostly solves "which preset voice to use"
- speaking style still sounds too close across personas
- generated text is spoken almost verbatim, so tone does not fully match `gentle`, `tsundere`, `cool`, etc.

## Design Summary

Use a three-layer tuning model:

1. Voice layer
   Map each `personalityId` to a fixed SiliconFlow preset voice.
2. Style layer
   Apply a server-side speech text transform before TTS. The transform keeps semantics unchanged while adjusting sentence rhythm, punctuation, colloquial particles, and delivery softness.
3. Emotion layer
   Apply small `speed` / `gain` offsets from the current `emotionState`, while keeping values intentionally conservative.

This gives a result that feels more like a romance game character, but still natural enough to sound like a real person speaking.

## Voice Mapping

| Persona | SiliconFlow Voice | Base Speed | Base Gain | Rationale |
| --- | --- | ---: | ---: | --- |
| `gentle` | `claire` | `0.97` | `-0.3` | Softer female tone, good for comforting and patient delivery |
| `tsundere` | `bella` | `1.02` | `0.4` | Sharper emotional edge, fits mild verbal pushback |
| `cute` | `diana` | `1.05` | `0.5` | Lighter and brighter, but still controlled |
| `cool` | `anna` | `0.94` | `-0.6` | More restrained and cool-headed |
| `warm_male` | `david` | `0.99` | `0.1` | Natural conversational warmth |
| `cold_male` | `benjamin` | `0.95` | `-0.5` | Colder, more restrained, lower emotional surface |
| `domineering_male` | `charles` | `0.98` | `0.3` | Stronger presence without becoming exaggerated |
| female fallback | `claire` | `0.98` | `0` | Safe default |
| male fallback | `alex` | `0.98` | `0` | Safe default |

## Style Transform Rules

The style transform must preserve meaning. It should not invent plot points, change scores, or alter the apology content itself.

It may adjust:

- punctuation density
- sentence splitting
- limited colloquial particles
- ending softness / firmness
- pause rhythm

It must not:

- add new factual content
- remove critical meaning
- rewrite the line into a different emotional stance
- add more than two new particles per utterance

### Persona Rules

#### `gentle`

- prefer complete sentences
- prefer `，` and `。` over repeated `！`
- allow at most one soft particle such as `呀` or `呢`
- soften the ending slightly

#### `tsundere`

- prefer shorter clauses
- allow one mild tsundere marker such as `哼` or `真是的`
- keep some resistance in tone
- avoid turning into exaggerated anime-style speech

#### `cute`

- slightly more colloquial and lively
- allow small particles like `呀` `啦` `嘛`
- maximum two particles total
- avoid excessive reduplication or childlike speech

#### `cool`

- remove unnecessary particles
- reduce repeated punctuation
- prefer shorter, restrained statements
- allow `……` for pause, but do not overuse it

#### `warm_male`

- natural and reassuring spoken rhythm
- allow one light softener like `好不好` when appropriate
- keep it grounded, not theatrical

#### `cold_male`

- short and controlled delivery
- stronger pause feeling
- avoid soft and clingy sentence endings

#### `domineering_male`

- direct rhythm
- less filler
- low particle usage
- maintain presence without sounding greasy or overacted

## Emotion Layer

Emotion tuning should remain light. The goal is to shift delivery, not create dramatic performance swings.

### State Buckets

- angry bucket: `暴怒`, `非常生气`
- hurt bucket: `委屈`, `难过`, `委屈生气`, `委屈落泪，不想理人`
- easing bucket: `还在生气`, `开始软化`
- forgiven bucket: `快哄好了`, `原谅了`

### Parameter Offsets

#### Angry

- `speed +0.03`
- `gain +0.4`
- for `gentle` and `cool`, cap gain increase to `+0.2`

#### Hurt

- `speed -0.05`
- `gain -0.4`
- prefer splitting long lines into two shorter spoken segments

#### Easing

- `speed -0.02 ~ +0.01`
- keep close to persona base values

#### Forgiven

- `speed +0.02`
- `gain +0.1`
- reduce harsh punctuation and aggressive phrasing

## Text Cleaning Rules

Before TTS submission:

- preserve `，。！？……`
- collapse repeated punctuation such as `!!!` and `？？？`
- normalize `...` to `……`
- strip markdown, code fences, numbering noise, and decorative quotes where possible
- remove most emoji before TTS submission
- split overly long spoken lines at punctuation or natural semantic boundaries
- target short spoken chunks, roughly 12 to 24 Chinese characters each when splitting is necessary

## Implementation Scope

### Files To Change

- `src/lib/ai/providers/siliconflow/speech-utils.ts`
  - add richer persona voice mapping
  - add style transform helpers
  - add emotion-aware speed/gain calculation
  - add text cleaning utilities
- `src/lib/ai/providers/siliconflow/speech-provider.ts`
  - send computed `speed` and `gain`
  - consume transformed speech text
- `src/lib/ai/services/speech-service.ts`
  - pass persona and emotion context down to speech provider
- `src/lib/ai/services/game-ai-service.ts`
  - pass `personalityId` and parsed `emotionState` into TTS calls
- tests under `src/lib/ai/providers/siliconflow/`
  - mapping tests
  - style transform tests
  - emotion parameter tests

### Interface Changes

No route-level response shape changes.

Internal service request expansion is allowed:

- add optional `personalityId`
- add optional `emotionState`

These remain server-internal and do not affect page components.

## Verification Plan

### Automated

- `pnpm test:unit`
- `pnpm ts-check`
- targeted `eslint` for changed files
- `pnpm lint`

### Manual Smoke Test

Verify:

- `game/start` speech sounds distinct between `gentle`, `tsundere`, `cool`
- `game/chat` speech changes slightly with different `emotionState`
- `voice-to-text` still returns stable transcription text
- fallback behavior remains intact if SiliconFlow speech fails

## Risks

- Over-stylizing text can make voices sound artificial or exaggerated
- Excessive punctuation transforms can hurt ASR round-trip quality if reused elsewhere
- Persona templates must stay conservative because the TTS model only offers preset voices, not full expressive controls

## Recommendation

Implement in one small pass with tests first:

1. Add failing tests for voice mapping, text transform, and emotion parameter output
2. Implement the style helpers
3. Wire helpers into SiliconFlow TTS
4. Run full verification

## Spec Review Notes

Self-review completed:

- no placeholders remain
- scope is limited to speech persona tuning
- route contracts remain unchanged
- risks and non-goals are explicit
