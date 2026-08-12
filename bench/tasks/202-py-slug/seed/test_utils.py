from utils import slug


def test_spaces_become_hyphens():
    assert slug("Hello World") == "hello-world"


def test_already_clean():
    assert slug("ready") == "ready"
