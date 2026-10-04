"""Regression for conditions accidentally serialized through list(text)."""
from validate import valid_prose_items


if __name__ == '__main__':
    sentence = 'Winter/spring PhD entry requires prior department contact.'
    assert valid_prose_items([sentence])
    assert valid_prose_items([])
    assert valid_prose_items([{'when': 'Transfer student', 'effect': 'Two Stanford quarters required'}])
    assert not valid_prose_items([{'when': 'Transfer student'}])
    assert not valid_prose_items(list(sentence))
    assert not valid_prose_items(sentence)
    assert not valid_prose_items([''])
    print('PASS: complete conditions retained; fragmented or invalid prose rejected')
