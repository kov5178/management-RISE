# Codex import prompt — RISE Excel data pack v2

이 데이터팩은 실제 파일 `성과지표 관리 현황표(260514) 최종_늘봄 수정.xlsm`을 기준으로 생성되었다.

## 핵심 변경점

2025 시트의 L열(실적값)에 적용된 수식을 상위/하위 지표 판정의 우선 근거로 사용한다.

- `L열에 수식이 있는 행` = 하위지표 실적과 가중치로 산출되는 `AUTO_FROM_CHILDREN` 상위지표
- `L열 수식에서 참조되는 L행` = 해당 상위지표의 하위지표
- 수식 근거가 없는 기존 추정 행 = `INFERRED_NO_2025_L_FORMULA`로 표시하고 관리자 검토 대상으로 둔다.

## 사용 파일

- `projects.csv`
- `tasks.csv`
- `indicators.csv`
- `indicator_targets.csv`
- `indicator_actuals.csv`
- `indicator_components.csv`
- `formula_links_2025_l.csv`
- `raw_2026_rows.csv`

## 구현 규칙

1. `indicators.csv`의 `indicator_id`를 안정 키로 사용한다.
2. `indicator_components.csv`를 기준으로 상위-하위 연결을 생성한다.
3. `source_level_confidence=FORMULA_2025_L`인 행은 확정 연결로 처리한다.
4. `formula_level_confidence=FORMULA_PARENT`인 지표는 `AUTO_FROM_CHILDREN`으로 저장하고 직접 입력을 차단한다.
5. `formula_level_confidence=FORMULA_CHILD`인 지표는 해당 상위지표의 하위지표로 저장한다.
6. `INFERRED_NO_2025_L_FORMULA` 행은 화면에서 검토 필요 배지를 표시한다.
7. `source_2025_l_formula`를 원문 수식으로 보존한다.
8. `formula_type_from_2025_l`가 `WEIGHTED_SUM`이면 `indicator_components.weight_value_2025`를 활용한다.
9. `formula_type_from_2025_l`가 `GROWTH_RATE`이면 `baseline_cell_2025`, `baseline_value_2025`를 보존하고 0 나누기 예외를 처리한다.
10. 상위지표 직접입력형은 하위지표 연결이 없는 경우에만 허용한다.

## 검증 필수

- 하위지표 실적 수정 시 `AUTO_FROM_CHILDREN` 상위지표 재계산
- 직접입력형 상위지표 저장 가능
- 자동산출형 상위지표 직접입력 차단
- 수식 참조 기반 구성요소 59건 import
- formula parent 26건 import
- `pnpm run typecheck`
- `pnpm run build`

## 데이터 유의사항

2025 L열 수식 중 일부는 가중치 참조 행이 하위지표 행과 다르다. 예: 2025 시트 L229 수식은 `L230`, `L231`을 참조하지만 가중치는 `$O$243`, `$O$244`를 참조한다. 이 값은 임의 수정하지 말고 원문 수식과 함께 검토 필요로 표시한다.
