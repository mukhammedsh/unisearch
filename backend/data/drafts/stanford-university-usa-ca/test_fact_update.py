"""Regression for the interrupted Symbolic Systems evidence correction loop."""


def correct_symbolic_facts(facts, coterm_fact):
    """Review a fixed snapshot; append the independently scoped coterm fact once."""
    for fact in tuple(facts):
        if fact['id'] == 'symsys-ms-deadline-requirements-funding-2027-28':
            fact['scope']['procedure_ids'] = ['symsys-ms-external']
            fact['scope']['applicant_categories'] = ['external_degree_applicant']
    if not any(fact['id'] == coterm_fact['id'] for fact in facts):
        facts.append(coterm_fact)


if __name__ == '__main__':
    facts = [{'id': 'other', 'scope': {}},
             {'id': 'symsys-ms-deadline-requirements-funding-2027-28',
              'scope': {'procedure_ids': ['symsys-ms-external', 'symsys-ms-coterm']}}]
    coterm = {'id': 'symsys-ms-coterm-window-and-requirements-2026-27',
              'scope': {'procedure_ids': ['symsys-ms-coterm'], 'applicant_categories': ['current_stanford_undergraduate']}}
    correct_symbolic_facts(facts, coterm)
    assert len(facts) == 3
    assert facts[1]['scope']['procedure_ids'] == ['symsys-ms-external']
    assert facts[2]['scope']['procedure_ids'] == ['symsys-ms-coterm']
    correct_symbolic_facts(facts, coterm)
    assert len(facts) == 3 and len({fact['id'] for fact in facts}) == 3
    print('PASS: 2 original facts + 1 coterm fact; repeated correction keeps 3 unique IDs')
