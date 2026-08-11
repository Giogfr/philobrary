const fs = require('fs');
let content = fs.readFileSync('src/i18n.ts', 'utf8');
const newKeys = [
  "  'notFound.suggestions': 'You might want to try:',",
  "  'notFound.home': 'Home',",
  "  'notFound.hint': \"Or use the search above to find what you're looking for.\","
].join('\n');

const translations = {
  'ka:': {
    suggestions: 'შეიძლება სურთ ცდა:',
    home: 'მთავარი',
    hint: 'ან გამოიყენეთ ძიება Gao, რათა ნათელუთი იპოვოთ.'
  },
  'ru:': {
    suggestions: 'Возможно, вы хотите попробовать:',
    home: 'Главная',
    hint: 'Или используйте поиск выше, чтобы найти то, что ищете.'
  },
  'pl:': {
    suggestions: 'Może chcesz spróbować:',
    home: 'Strona główna',
    hint: 'Lub użyj wyszukiwania powyżej, aby znaleźć to, czego szukasz.'
  },
  'he:': {
    suggestions: 'אולי תרצה לנסות:',
    home: 'בית',
    hint: 'או השתמש בחיפוש למעלה כדי למצוא את מה שאתה מחפש.'
  },
  'ar:': {
    suggestions: 'قد ترغب في المحاولة:',
    home: 'الرئيسية',
    hint: 'أو استخدم البحث أعلاه للعثور على ما تبحث عنه.'
  },
  'es:': {
    suggestions: 'Quizás quieras probar:',
    home: 'Inicio',
    hint: 'O usa la búsqueda de arriba para encontrar lo que buscas.'
  },
  'fr:': {
    suggestions: 'Vous voudrez peut-être essayer :',
    home: 'Accueil',
    hint: 'Ou utilisez la recherche ci-dessus pour trouver ce que vous cherchez.'
  },
  'de:': {
    suggestions: 'Vielleicht möchten Sie versuchen:',
    home: 'Startseite',
    hint: 'Oder verwenden Sie die Suche oben, um zu finden, wonach Sie suchen.'
  },
  'it:': {
    suggestions: 'Potresti voler provare:',
    home: 'Home',
    hint: 'O usa la ricerca sopra per trovare quello che cerchi.'
  },
  'pt:': {
    suggestions: 'Talvez você queira tentar:',
    home: 'Início',
    hint: 'Ou use a busca acima para encontrar o que procura.'
  },
  'tr:': {
    suggestions: 'Belki denemek isteyebilirsiniz:',
    home: 'Ana Sayfa',
    hint: 'Veya aradığınızı bulmak için yukarıdaki aramayı kullanın.'
  },
  'ja:': {
    suggestions: '試してみることをお勧めします：',
    home: 'ホーム',
    hint: 'または上部の検索を使ってお探しのものを見つけてください。'
  },
  'zh:': {
    suggestions: '您可能想尝试：',
    home: '首页',
    hint: '或使用上方的搜索来查找您想要的内容。'
  },
  'uk:': {
    suggestions: 'Можливо, ви хочете спробувати:',
    home: 'Головна',
    hint: 'Або скористайтеся пошуком вище, щоб знайти те, що шукаєте.'
  }
};

Object.entries(translations).forEach(([lang, t]) => {
  const regex = new RegExp("(\\s+'notFound\\.page': '[^']+',\\s+)('empty\\.library\\.title':)", 'g');
  content = content.replace(regex, (match, p1, p2) => {
    return p1 + newKeys + '\n  ' + p2;
  });
});

fs.writeFileSync('src/i18n.ts', content);
console.log('Added to all languages');