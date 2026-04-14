import { FlagCultureQuestion } from '../models/flag-culture-question';

export const FLAG_CULTURE_STATIC_QUESTIONS: FlagCultureQuestion[] = [
  {
    id: 'culture-easy-nepal-shape',
    difficulty: 'easy',
    topic: 'record',
    prompt: 'Quel pays a un drapeau national non rectangulaire ?',
    options: ['Népal', 'Bhoutan', 'Qatar', 'Suisse'],
    correctAnswer: 'Népal',
    explanation: 'Le drapeau du Népal est composé de deux pennons superposés.',
    countryCode: 'np',
    sourceUrl: 'https://en.wikipedia.org/wiki/Flag_of_Nepal'
  },
  {
    id: 'culture-easy-mozambique-ak47',
    difficulty: 'easy',
    topic: 'symbol',
    prompt: 'Quel drapeau national affiche un fusil AK-47 ?',
    options: ['Mozambique', 'Angola', 'Zimbabwe', 'Namibie'],
    correctAnswer: 'Mozambique',
    explanation: "Le drapeau du Mozambique inclut un AK-47 dans son emblème depuis l\'indépendance.",
    countryCode: 'mz',
    sourceUrl: 'https://en.wikipedia.org/wiki/Flag_of_Mozambique'
  },
  {
    id: 'culture-easy-usa-stars',
    difficulty: 'easy',
    topic: 'symbol',
    prompt: 'Combien d\'étoiles compte le drapeau des États-Unis ?',
    options: ['50', '48', '52', '13'],
    correctAnswer: '50',
    explanation: 'Chaque étoile représente un État américain.',
    countryCode: 'us',
    sourceUrl: 'https://en.wikipedia.org/wiki/Flag_of_the_United_States'
  },
  {
    id: 'culture-easy-usa-stripes',
    difficulty: 'easy',
    topic: 'history',
    prompt: 'Combien de bandes a le drapeau des États-Unis ?',
    options: ['13', '10', '15', '50'],
    correctAnswer: '13',
    explanation: "Les 13 bandes représentent les 13 colonies d'origine.",
    countryCode: 'us',
    sourceUrl: 'https://en.wikipedia.org/wiki/Flag_of_the_United_States'
  },
  {
    id: 'culture-easy-india-spokes',
    difficulty: 'easy',
    topic: 'symbol',
    prompt: 'Le chakra au centre du drapeau indien comporte combien de rayons ?',
    options: ['24', '18', '12', '32'],
    correctAnswer: '24',
    explanation: "Le cercle bleu est l\'Ashoka Chakra à 24 rayons.",
    countryCode: 'in',
    sourceUrl: 'https://en.wikipedia.org/wiki/Flag_of_India'
  },
  {
    id: 'culture-easy-brazil-motto',
    difficulty: 'easy',
    topic: 'symbol',
    prompt: 'Quel texte est écrit sur le drapeau du Brésil ?',
    options: ['Ordem e Progresso', 'Liberdade', 'Uniao e Forca', 'Paz e Futuro'],
    correctAnswer: 'Ordem e Progresso',
    explanation: "Le motto apparaît sur la bande blanche au centre de la sphère bleue.",
    countryCode: 'br',
    sourceUrl: 'https://en.wikipedia.org/wiki/Flag_of_Brazil'
  },
  {
    id: 'culture-easy-cyprus-map',
    difficulty: 'easy',
    topic: 'design',
    prompt: 'Quel drapeau national montre la carte de son île ?',
    options: ['Chypre', 'Malte', 'Crète', 'Sicile'],
    correctAnswer: 'Chypre',
    explanation: 'Le drapeau chypriote affiche la carte de l\'île en couleur cuivre.',
    countryCode: 'cy',
    sourceUrl: 'https://en.wikipedia.org/wiki/Flag_of_Cyprus'
  },
  {
    id: 'culture-easy-kosovo-map',
    difficulty: 'easy',
    topic: 'design',
    prompt: 'Quel drapeau montre une carte dorée avec six étoiles au-dessus ?',
    options: ['Kosovo', 'Bosnie-Herzégovine', 'Macédoine du Nord', 'Albanie'],
    correctAnswer: 'Kosovo',
    explanation: 'Le drapeau du Kosovo affiche la carte du territoire sur fond bleu.',
    countryCode: 'xk',
    sourceUrl: 'https://en.wikipedia.org/wiki/Flag_of_Kosovo'
  },
  {
    id: 'culture-easy-canada-year',
    difficulty: 'easy',
    topic: 'history',
    prompt: 'En quelle année le drapeau à feuille d\'érable du Canada a-t-il été adopté ?',
    options: ['1965', '1957', '1972', '1949'],
    correctAnswer: '1965',
    explanation: 'Le drapeau actuel du Canada est officiellement adopté en 1965.',
    countryCode: 'ca',
    sourceUrl: 'https://en.wikipedia.org/wiki/Flag_of_Canada'
  },
  {
    id: 'culture-easy-south-africa-year',
    difficulty: 'easy',
    topic: 'history',
    prompt: 'Le drapeau actuel de l\'Afrique du Sud a été introduit en...',
    options: ['1994', '1990', '2001', '1984'],
    correctAnswer: '1994',
    explanation: 'Il a été introduit au moment de la transition démocratique.',
    countryCode: 'za',
    sourceUrl: 'https://en.wikipedia.org/wiki/Flag_of_South_Africa'
  },
  {
    id: 'culture-easy-bangladesh-disc',
    difficulty: 'easy',
    topic: 'design',
    prompt: 'Sur le drapeau du Bangladesh, le disque rouge est placé...',
    options: ['légèrement vers la hampe', 'exactement au centre', 'légèrement vers la droite', 'en haut à gauche'],
    correctAnswer: 'légèrement vers la hampe',
    explanation: "Le disque est décalé vers la hampe pour paraître centré quand le drapeau flotte.",
    countryCode: 'bd',
    sourceUrl: 'https://en.wikipedia.org/wiki/Flag_of_Bangladesh'
  },
  {
    id: 'culture-easy-mexico-emblem',
    difficulty: 'easy',
    topic: 'symbol',
    prompt: 'Quel animal apparaît au centre du drapeau mexicain ?',
    options: ['Un aigle', 'Un condor', 'Un jaguar', 'Un loup'],
    correctAnswer: 'Un aigle',
    explanation: 'L\'aigle tient un serpent sur un cactus, symbole historique du Mexique.',
    countryCode: 'mx',
    sourceUrl: 'https://en.wikipedia.org/wiki/Flag_of_Mexico'
  },
  {
    id: 'culture-easy-bhutan-dragon',
    difficulty: 'easy',
    topic: 'symbol',
    prompt: 'Quel drapeau national contient un dragon blanc ?',
    options: ['Bhoutan', 'Mongolie', 'Tibet', 'Népal'],
    correctAnswer: 'Bhoutan',
    explanation: "Le dragon, Druk, est un symbole central de l\'identité bhoutanaise.",
    countryCode: 'bt',
    sourceUrl: 'https://en.wikipedia.org/wiki/Flag_of_Bhutan'
  },
  {
    id: 'culture-medium-denmark-oldest',
    difficulty: 'medium',
    topic: 'history',
    prompt: 'Le Dannebrog est le nom du drapeau national de quel pays ?',
    options: ['Danemark', 'Portugal', 'Autriche', 'Suède'],
    correctAnswer: 'Danemark',
    explanation: 'Dannebrog est le nom historique du drapeau du Danemark.',
    countryCode: 'dk',
    sourceUrl: 'https://en.wikipedia.org/wiki/Flag_of_Denmark'
  },
  {
    id: 'culture-medium-switzerland-square',
    difficulty: 'medium',
    topic: 'record',
    prompt: 'Quel pays possède un drapeau national carré ?',
    options: ['Suisse', 'Autriche', 'Serbie', 'Pologne'],
    correctAnswer: 'Suisse',
    explanation: 'La Suisse utilise un drapeau carré pour son usage national.',
    countryCode: 'ch',
    sourceUrl: 'https://en.wikipedia.org/wiki/Flag_of_Switzerland'
  },
  {
    id: 'culture-medium-vatican-square',
    difficulty: 'medium',
    topic: 'record',
    prompt: 'Avec la Suisse, quel autre État utilise un drapeau carré ?',
    options: ['Vatican', 'Monaco', 'Saint-Marin', 'Andorre'],
    correctAnswer: 'Vatican',
    explanation: 'Le drapeau du Vatican est carré et bicolore jaune-blanc.',
    countryCode: 'va',
    sourceUrl: 'https://en.wikipedia.org/wiki/Flag_of_Vatican_City'
  },
  {
    id: 'culture-medium-japan-law',
    difficulty: 'medium',
    topic: 'history',
    prompt: 'En quelle année le drapeau japonais a-t-il été codifié par loi spécifique ?',
    options: ['1999', '1947', '1989', '2005'],
    correctAnswer: '1999',
    explanation: 'La loi sur le drapeau et l\'hymne national a été promulguée en 1999.',
    countryCode: 'jp',
    sourceUrl: 'https://en.wikipedia.org/wiki/Flag_of_Japan'
  },
  {
    id: 'culture-medium-georgia-year',
    difficulty: 'medium',
    topic: 'history',
    prompt: 'Le drapeau actuel de la Géorgie (croix et quatre petites croix) date de...',
    options: ['2004', '1991', '2011', '1989'],
    correctAnswer: '2004',
    explanation: 'La Géorgie a adopté ce design en 2004.',
    countryCode: 'ge',
    sourceUrl: 'https://en.wikipedia.org/wiki/Flag_of_Georgia_(country)'
  },
  {
    id: 'culture-medium-rwanda-year',
    difficulty: 'medium',
    topic: 'history',
    prompt: 'Le drapeau actuel du Rwanda avec soleil jaune a été adopté en...',
    options: ['2001', '1994', '2010', '1988'],
    correctAnswer: '2001',
    explanation: 'Le Rwanda a introduit ce drapeau en 2001.',
    countryCode: 'rw',
    sourceUrl: 'https://en.wikipedia.org/wiki/Flag_of_Rwanda'
  },
  {
    id: 'culture-medium-libya-green',
    difficulty: 'medium',
    topic: 'history',
    prompt: 'Quel pays a utilisé un drapeau entièrement vert de 1977 à 2011 ?',
    options: ['Libye', 'Arabie saoudite', 'Mauritanie', 'Pakistan'],
    correctAnswer: 'Libye',
    explanation: 'La Libye a utilisé un drapeau vert uni pendant cette période.',
    countryCode: 'ly',
    sourceUrl: 'https://en.wikipedia.org/wiki/Flag_of_Libya'
  },
  {
    id: 'culture-medium-paraguay-two-sides',
    difficulty: 'medium',
    topic: 'design',
    prompt: 'Quel pays a des armoiries différentes entre l\'avers et le revers de son drapeau ?',
    options: ['Paraguay', 'Pérou', 'Serbie', 'Équateur'],
    correctAnswer: 'Paraguay',
    explanation: 'Le Paraguay montre deux sceaux différents selon la face du drapeau.',
    countryCode: 'py',
    sourceUrl: 'https://en.wikipedia.org/wiki/Flag_of_Paraguay'
  },
  {
    id: 'culture-medium-eu-stars',
    difficulty: 'medium',
    topic: 'symbol',
    prompt: 'Sur le drapeau européen, les 12 étoiles représentent surtout...',
    options: ["Un idéal d'unité et de plénitude", 'Le nombre des pays fondateurs', "Les 12 mois de l'année", "Les 12 premières capitales de l'UE"],
    correctAnswer: "Un idéal d'unité et de plénitude",
    explanation: "Le nombre 12 est symbolique et ne dépend pas du nombre d\'États membres.",
    sourceUrl: 'https://european-union.europa.eu/principles-countries-history/symbols/european-flag_en'
  },
  {
    id: 'culture-medium-saudi-half-mast',
    difficulty: 'medium',
    topic: 'symbol',
    prompt: 'Pourquoi le drapeau saoudien est-il généralement évité en berne ?',
    options: [
      'Il contient la profession de foi islamique',
      'Son tissu est trop fragile',
      'Sa taille standard ne le permet pas',
      'Il est réservé aux bâtiments religieux'
    ],
    correctAnswer: 'Il contient la profession de foi islamique',
    explanation: 'La shahada inscrite sur le drapeau explique cette pratique protocolaire.',
    countryCode: 'sa',
    sourceUrl: 'https://en.wikipedia.org/wiki/Flag_of_Saudi_Arabia'
  },
  {
    id: 'culture-medium-qatar-serrations',
    difficulty: 'medium',
    topic: 'design',
    prompt: 'Combien de pointes blanches séparent les deux couleurs du drapeau du Qatar ?',
    options: ['9', '5', '7', '11'],
    correctAnswer: '9',
    explanation: 'Le drapeau du Qatar est reconnaissable à ses neuf dentures blanches.',
    countryCode: 'qa',
    sourceUrl: 'https://en.wikipedia.org/wiki/Flag_of_Qatar'
  },
  {
    id: 'culture-medium-albania-eagle',
    difficulty: 'medium',
    topic: 'symbol',
    prompt: "Quel animal figure sur le drapeau de l'Albanie ?",
    options: ['Un aigle bicéphale', 'Un lion', 'Un cheval', 'Un ours'],
    correctAnswer: 'Un aigle bicéphale',
    explanation: 'Le drapeau albanais montre un aigle noir à deux têtes sur fond rouge.',
    countryCode: 'al',
    sourceUrl: 'https://en.wikipedia.org/wiki/Flag_of_Albania'
  },
  {
    id: 'culture-medium-morocco-star',
    difficulty: 'medium',
    topic: 'symbol',
    prompt: "De quelle couleur est l'étoile du drapeau marocain ?",
    options: ['Verte', 'Noire', 'Blanche', 'Dorée'],
    correctAnswer: 'Verte',
    explanation: 'Le drapeau marocain affiche une étoile verte sur fond rouge.',
    countryCode: 'ma',
    sourceUrl: 'https://en.wikipedia.org/wiki/Flag_of_Morocco'
  },
  {
    id: 'culture-medium-un-olive',
    difficulty: 'medium',
    topic: 'symbol',
    prompt: "Quel symbole de paix entoure la carte sur le drapeau de l'ONU ?",
    options: ['Deux branches d\'olivier', 'Deux lauriers', 'Deux épis de blé', 'Deux palmes'],
    correctAnswer: 'Deux branches d\'olivier',
    explanation: 'Les branches d\'olivier sont associées à la paix internationale.',
    sourceUrl: 'https://www.un.org/en/about-us/un-emblem-and-flag'
  },
  {
    id: 'culture-hard-nepal-pennons',
    difficulty: 'hard',
    topic: 'design',
    prompt: 'Le drapeau du Népal est composé de combien de pennons ?',
    options: ['2', '3', '1', '4'],
    correctAnswer: '2',
    explanation: 'La structure traditionnelle du drapeau népalais combine deux pennons.',
    countryCode: 'np',
    sourceUrl: 'https://en.wikipedia.org/wiki/Flag_of_Nepal'
  },
  {
    id: 'culture-hard-eu-constant-stars',
    difficulty: 'hard',
    topic: 'history',
    prompt: 'Le nombre d\'étoiles du drapeau européen change-t-il avec le nombre de pays membres ?',
    options: ['Non, il reste 12', 'Oui, il suit le nombre de membres', 'Oui, tous les 10 ans', 'Il dépend de la présidence tournante'],
    correctAnswer: 'Non, il reste 12',
    explanation: "Le chiffre 12 est symbolique et constant dans l\'identité visuelle européenne.",
    sourceUrl: 'https://european-union.europa.eu/principles-countries-history/symbols/european-flag_en'
  },
  {
    id: 'culture-hard-libya-years',
    difficulty: 'hard',
    topic: 'history',
    prompt: 'Le drapeau vert uni de la Libye a été utilisé entre...',
    options: ['1977 et 2011', '1969 et 1990', '1980 et 2001', '1992 et 2011'],
    correctAnswer: '1977 et 2011',
    explanation: 'Cette période correspond au drapeau uni de la Jamahiriya.',
    countryCode: 'ly',
    sourceUrl: 'https://en.wikipedia.org/wiki/Flag_of_Libya'
  },
  {
    id: 'culture-hard-canada-leaf-points',
    difficulty: 'hard',
    topic: 'design',
    prompt: 'La feuille d\'érable stylisée du drapeau canadien possède combien de pointes ?',
    options: ['11', '9', '13', '7'],
    correctAnswer: '11',
    explanation: 'La feuille centrale est un dessin stylisé à 11 pointes.',
    countryCode: 'ca',
    sourceUrl: 'https://en.wikipedia.org/wiki/Flag_of_Canada'
  },
  {
    id: 'culture-hard-kosovo-stars',
    difficulty: 'hard',
    topic: 'symbol',
    prompt: 'Combien d\'étoiles figurent au-dessus de la carte sur le drapeau du Kosovo ?',
    options: ['6', '5', '7', '8'],
    correctAnswer: '6',
    explanation: 'Six étoiles blanches figurent au-dessus de la carte du Kosovo.',
    countryCode: 'xk',
    sourceUrl: 'https://en.wikipedia.org/wiki/Flag_of_Kosovo'
  },
  {
    id: 'culture-hard-cyprus-metal',
    difficulty: 'hard',
    topic: 'symbol',
    prompt: 'La couleur de la carte sur le drapeau de Chypre renvoie principalement à...',
    options: ['Le cuivre', 'Le fer', 'Le pétrole', 'Le marbre'],
    correctAnswer: 'Le cuivre',
    explanation: 'La teinte cuivre évoque les gisements historiquement associés à l\'île.',
    countryCode: 'cy',
    sourceUrl: 'https://en.wikipedia.org/wiki/Flag_of_Cyprus'
  },
  {
    id: 'culture-hard-qatar-proportion',
    difficulty: 'hard',
    topic: 'record',
    prompt: 'Quel pays possède un drapeau national très allongé (proportion proche de 11:28) ?',
    options: ['Qatar', 'Bahreïn', 'Arabie saoudite', 'Koweït'],
    correctAnswer: 'Qatar',
    explanation: 'Le drapeau du Qatar a une proportion très étirée et une couleur bordeaux distincte.',
    countryCode: 'qa',
    sourceUrl: 'https://en.wikipedia.org/wiki/Flag_of_Qatar'
  },
  {
    id: 'culture-hard-uae-year',
    difficulty: 'hard',
    topic: 'history',
    prompt: 'Le drapeau des Émirats arabes unis a été adopté en...',
    options: ['1971', '1965', '1980', '1991'],
    correctAnswer: '1971',
    explanation: "Il est adopté à la création de la fédération des Émirats arabes unis.",
    countryCode: 'ae',
    sourceUrl: 'https://en.wikipedia.org/wiki/Flag_of_the_United_Arab_Emirates'
  },
  {
    id: 'culture-hard-triangle-question',
    difficulty: 'hard',
    topic: 'comparison',
    prompt: 'Quel pays n\'utilise PAS de triangle au guindant sur son drapeau national ?',
    options: ['Japon', 'Jordanie', 'Tchéquie', 'Bahamas'],
    correctAnswer: 'Japon',
    explanation: 'La Jordanie, la Tchéquie et les Bahamas ont un triangle côté hampe, pas le Japon.',
    countryCode: 'jp'
  },
  {
    id: 'culture-hard-square-pair',
    difficulty: 'hard',
    topic: 'comparison',
    prompt: 'Parmi ces paires, laquelle correspond aux deux États ayant un drapeau carré ?',
    options: [
      'Suisse et Vatican',
      'Qatar et Bahreïn',
      'Japon et Népal',
      'Portugal et Espagne'
    ],
    correctAnswer: 'Suisse et Vatican',
    explanation: 'Les deux États modernes avec drapeau national carré sont la Suisse et le Vatican.',
    sourceUrl: 'https://en.wikipedia.org/wiki/Flag_of_Vatican_City'
  },
  {
    id: 'culture-hard-paraguay-seal',
    difficulty: 'hard',
    topic: 'design',
    prompt: 'Sur le revers du drapeau paraguayen, quel sceau apparaît ?',
    options: [
      'Le sceau du Trésor national',
      'Le même blason que sur l\'avers',
      'Le blason du président',
      'Aucun emblème'
    ],
    correctAnswer: 'Le sceau du Trésor national',
    explanation: 'Le revers paraguayen affiche le sceau du Trésor national.',
    countryCode: 'py',
    sourceUrl: 'https://en.wikipedia.org/wiki/Flag_of_Paraguay'
  },
  {
    id: 'culture-hard-bangladesh-optic',
    difficulty: 'hard',
    topic: 'design',
    prompt: 'Pourquoi le disque rouge du Bangladesh est-il décalé vers la hampe ?',
    options: [
      'Pour paraître centré quand le drapeau flotte',
      'Pour laisser la place au blason',
      'Pour différencier marine et terrestre',
      'Pour respecter une règle coloniale'
    ],
    correctAnswer: 'Pour paraître centré quand le drapeau flotte',
    explanation: 'Le décalage corrige l\'effet visuel du drapeau en mouvement.',
    countryCode: 'bd',
    sourceUrl: 'https://en.wikipedia.org/wiki/Flag_of_Bangladesh'
  },
  {
    id: 'culture-hard-mozambique-symbols',
    difficulty: 'hard',
    topic: 'symbol',
    prompt: 'Outre le fusil, quel symbole de connaissance figure sur le drapeau du Mozambique ?',
    options: ['Un livre ouvert', 'Une plume', 'Une lampe', 'Une boussole'],
    correctAnswer: 'Un livre ouvert',
    explanation: 'Le drapeau du Mozambique intègre un livre ouvert et une houe dans son emblème.',
    countryCode: 'mz',
    sourceUrl: 'https://en.wikipedia.org/wiki/Flag_of_Mozambique'
  },
  {
    id: 'culture-hard-japan-name',
    difficulty: 'hard',
    topic: 'history',
    prompt: 'Quel est le nom courant du drapeau japonais ?',
    options: ['Hinomaru', 'Sakura', 'Yamato', 'Nippon-sho'],
    correctAnswer: 'Hinomaru',
    explanation: "Le nom courant est Hinomaru, cercle solaire rouge sur fond blanc.",
    countryCode: 'jp',
    sourceUrl: 'https://en.wikipedia.org/wiki/Flag_of_Japan'
  },
  {
    id: 'culture-easy-cambodia-angkor',
    difficulty: 'easy',
    topic: 'symbol',
    prompt: 'Quel pays affiche Angkor Wat sur son drapeau national ?',
    options: ['Cambodge', 'Thaïlande', 'Laos', 'Myanmar'],
    correctAnswer: 'Cambodge',
    explanation: 'Le drapeau du Cambodge montre la silhouette blanche d\'Angkor Wat.',
    countryCode: 'kh',
    sourceUrl: 'https://en.wikipedia.org/wiki/Flag_of_Cambodia'
  },
  {
    id: 'culture-easy-kenya-shield',
    difficulty: 'easy',
    topic: 'symbol',
    prompt: 'Quel drapeau affiche un bouclier maasaï et deux lances croisées ?',
    options: ['Kenya', 'Ouganda', 'Tanzanie', 'Zambie'],
    correctAnswer: 'Kenya',
    explanation: 'Le drapeau kenyan comporte un bouclier maasaï avec deux lances blanches croisées.',
    countryCode: 'ke',
    sourceUrl: 'https://en.wikipedia.org/wiki/Flag_of_Kenya'
  },
  {
    id: 'culture-easy-sri-lanka-lion',
    difficulty: 'easy',
    topic: 'symbol',
    prompt: 'Quel drapeau contient un lion tenant une épée ?',
    options: ['Sri Lanka', 'Bhoutan', 'Népal', 'Montenegro'],
    correctAnswer: 'Sri Lanka',
    explanation: 'Le drapeau du Sri Lanka est connu comme le Lion Flag.',
    countryCode: 'lk',
    sourceUrl: 'https://en.wikipedia.org/wiki/Flag_of_Sri_Lanka'
  },
  {
    id: 'culture-easy-romania-chad',
    difficulty: 'easy',
    topic: 'comparison',
    prompt: 'Quel duo est célèbre pour ses drapeaux très similaires bleu-jaune-rouge verticaux ?',
    options: ['Roumanie et Tchad', 'Moldavie et Roumanie', 'Belgique et Allemagne', 'France et Italie'],
    correctAnswer: 'Roumanie et Tchad',
    explanation: 'Les drapeaux de la Roumanie et du Tchad sont quasi identiques, avec un bleu légèrement différent.',
    sourceUrl: 'https://en.wikipedia.org/wiki/Chad%E2%80%93Romania_relations'
  },
  {
    id: 'culture-easy-canada-flagday-date',
    difficulty: 'easy',
    topic: 'history',
    prompt: 'La Journée du drapeau canadien est célébrée chaque année le...',
    options: ['15 février', '1 juillet', '11 novembre', '28 janvier'],
    correctAnswer: '15 février',
    explanation: 'Le Canada célèbre officiellement la Journée du drapeau le 15 février.',
    countryCode: 'ca',
    sourceUrl: 'https://www.canada.ca/flagday'
  },
  {
    id: 'culture-easy-haiti-panel',
    difficulty: 'easy',
    topic: 'design',
    prompt: 'Le drapeau national d\'Haïti comprend, au centre...',
    options: [
      'Un panneau blanc avec les armoiries',
      'Une étoile jaune',
      'Un croissant blanc',
      'Une carte du pays'
    ],
    correctAnswer: 'Un panneau blanc avec les armoiries',
    explanation: 'Le drapeau national haïtien ajoute les armoiries sur un panneau blanc central.',
    countryCode: 'ht',
    sourceUrl: 'https://en.wikipedia.org/wiki/Flag_of_Haiti'
  },
  {
    id: 'culture-easy-dominica-stars',
    difficulty: 'easy',
    topic: 'symbol',
    prompt: 'Combien d\'étoiles entourent le perroquet sur le drapeau de la Dominique ?',
    options: ['10', '8', '12', '6'],
    correctAnswer: '10',
    explanation: 'Les 10 étoiles représentent les 10 paroisses de la Dominique.',
    countryCode: 'dm',
    sourceUrl: 'https://en.wikipedia.org/wiki/Flag_of_Dominica'
  },
  {
    id: 'culture-medium-seychelles-bands',
    difficulty: 'medium',
    topic: 'design',
    prompt: 'Le drapeau des Seychelles comporte combien de bandes obliques rayonnantes ?',
    options: ['5', '4', '6', '7'],
    correctAnswer: '5',
    explanation: 'Le drapeau seychellois affiche cinq bandes obliques qui partent du bas côté hampe.',
    countryCode: 'sc',
    sourceUrl: 'https://en.wikipedia.org/wiki/Flag_of_Seychelles'
  },
  {
    id: 'culture-medium-bahrain-points',
    difficulty: 'medium',
    topic: 'design',
    prompt: 'Combien de pointes blanches à la séparation du drapeau de Bahreïn ?',
    options: ['5', '9', '7', '3'],
    correctAnswer: '5',
    explanation: 'Le drapeau de Bahreïn utilise une ligne en dents de scie à cinq pointes.',
    countryCode: 'bh',
    sourceUrl: 'https://en.wikipedia.org/wiki/Flag_of_Bahrain'
  },
  {
    id: 'culture-medium-liechtenstein-crown',
    difficulty: 'medium',
    topic: 'history',
    prompt: 'Pourquoi le Liechtenstein a-t-il ajouté une couronne sur son drapeau en 1937 ?',
    options: [
      'Pour le différencier du drapeau civil haïtien',
      'Pour marquer son entrée à l\'ONU',
      'Pour unifier ses cantons',
      'Pour célébrer une victoire militaire'
    ],
    correctAnswer: 'Pour le différencier du drapeau civil haïtien',
    explanation: 'La couronne est ajoutée après la confusion constatée aux JO de Berlin 1936.',
    countryCode: 'li',
    sourceUrl: 'https://en.wikipedia.org/wiki/Flag_of_Liechtenstein'
  },
  {
    id: 'culture-medium-pakistan-stripe',
    difficulty: 'medium',
    topic: 'symbol',
    prompt: 'Sur le drapeau pakistanais, la bande blanche côté hampe représente...',
    options: [
      'Les minorités religieuses',
      'Les montagnes enneigées',
      'Le pouvoir judiciaire',
      'Les provinces côtières'
    ],
    correctAnswer: 'Les minorités religieuses',
    explanation: 'La bande blanche symbolise les minorités non musulmanes du pays.',
    countryCode: 'pk',
    sourceUrl: 'https://en.wikipedia.org/wiki/Flag_of_Pakistan'
  },
  {
    id: 'culture-medium-north-macedonia-rays',
    difficulty: 'medium',
    topic: 'design',
    prompt: 'Le soleil du drapeau de Macédoine du Nord possède combien de grands rayons ?',
    options: ['8', '12', '16', '24'],
    correctAnswer: '8',
    explanation: 'Le design actuel montre un soleil stylisé à huit rayons.',
    countryCode: 'mk',
    sourceUrl: 'https://en.wikipedia.org/wiki/Flag_of_North_Macedonia'
  },
  {
    id: 'culture-medium-malaysia-stripes',
    difficulty: 'medium',
    topic: 'design',
    prompt: 'Combien de bandes rouges et blanches compte le drapeau de la Malaisie ?',
    options: ['14', '13', '12', '11'],
    correctAnswer: '14',
    explanation: 'Le drapeau malaisien comporte 14 bandes horizontales alternées.',
    countryCode: 'my',
    sourceUrl: 'https://en.wikipedia.org/wiki/Flag_of_Malaysia'
  },
  {
    id: 'culture-medium-brazil-sky-date',
    difficulty: 'medium',
    topic: 'history',
    prompt: 'Le ciel étoile du drapeau brésilien est associé à quelle date historique ?',
    options: ['15 novembre 1889', '7 septembre 1822', '1 janvier 1900', '22 avril 1500'],
    correctAnswer: '15 novembre 1889',
    explanation: 'La position des étoiles renvoie au ciel de Rio le 15 novembre 1889.',
    countryCode: 'br',
    sourceUrl: 'https://en.wikipedia.org/wiki/Flag_of_Brazil'
  },
  {
    id: 'culture-medium-cyprus-neutral-rules',
    difficulty: 'medium',
    topic: 'history',
    prompt: 'Dans sa version d\'indépendance, le drapeau de Chypre devait éviter...',
    options: [
      'Le bleu, le rouge, la croix et le croissant',
      'Le blanc et le vert',
      'Les étoiles et les bandes',
      'Les symboles cartographiques'
    ],
    correctAnswer: 'Le bleu, le rouge, la croix et le croissant',
    explanation: 'La constitution chypriote imposait un design neutre sans ces références.',
    countryCode: 'cy',
    sourceUrl: 'https://en.wikipedia.org/wiki/Flag_of_Cyprus'
  },
  {
    id: 'culture-hard-monaco-indonesia-ratios',
    difficulty: 'hard',
    topic: 'comparison',
    prompt: 'Quel couple de proportions est correct pour Monaco puis l\'Indonésie ?',
    options: ['4:5 et 2:3', '2:3 et 4:5', '1:2 et 2:3', '3:5 et 1:2'],
    correctAnswer: '4:5 et 2:3',
    explanation: 'Les deux drapeaux se ressemblent, mais leurs proportions officielles diffèrent.',
    sourceUrl: 'https://en.wikipedia.org/wiki/Flag_of_Monaco'
  },
  {
    id: 'culture-hard-rwanda-rays',
    difficulty: 'hard',
    topic: 'design',
    prompt: 'Le soleil en haut à droite du drapeau rwandais comporte combien de rayons ?',
    options: ['24', '16', '20', '32'],
    correctAnswer: '24',
    explanation: 'Le soleil du drapeau rwandais est dessiné avec 24 rayons.',
    countryCode: 'rw',
    sourceUrl: 'https://en.wikipedia.org/wiki/Flag_of_Rwanda'
  },
  {
    id: 'culture-hard-kazakhstan-rays',
    difficulty: 'hard',
    topic: 'design',
    prompt: 'Combien de rayons compte le soleil du drapeau du Kazakhstan ?',
    options: ['32', '24', '16', '40'],
    correctAnswer: '32',
    explanation: 'Le soleil du drapeau kazakh est représente avec 32 rayons.',
    countryCode: 'kz',
    sourceUrl: 'https://en.wikipedia.org/wiki/Flag_of_Kazakhstan'
  },
  {
    id: 'culture-hard-bosnia-stars',
    difficulty: 'hard',
    topic: 'symbol',
    prompt: 'Sur le drapeau bosnien, les étoiles blanches le long du triangle sont conçues pour être...',
    options: ['Potentiellement infinies', 'Au nombre exact de 9', 'Limitées aux 7 cantons', 'Uniquement décoratives'],
    correctAnswer: 'Potentiellement infinies',
    explanation: 'Les étoiles sont prolongées en haut et en bas pour suggérer un nombre infini.',
    countryCode: 'ba',
    sourceUrl: 'https://en.wikipedia.org/wiki/Flag_of_Bosnia_and_Herzegovina'
  },
  {
    id: 'culture-hard-haiti-liechtenstein-jo',
    difficulty: 'hard',
    topic: 'history',
    prompt: 'Quel événement a révélé en 1936 la ressemblance entre drapeaux haïtien (civil) et liechtensteinois ?',
    options: ['Les Jeux olympiques de Berlin', 'Une conférence à Genève', 'Une exposition universelle', "La création de l'ONU"],
    correctAnswer: 'Les Jeux olympiques de Berlin',
    explanation: 'La confusion est apparue pendant les JO de 1936 à Berlin.',
    sourceUrl: 'https://en.wikipedia.org/wiki/Liechtenstein_at_the_1936_Summer_Olympics'
  },
  {
    id: 'culture-hard-bahrain-qatar-comparison',
    difficulty: 'hard',
    topic: 'comparison',
    prompt: 'Quelle combinaison est correcte pour Qatar puis Bahreïn ?',
    options: [
      '9 pointes et 5 pointes',
      '5 pointes et 9 pointes',
      '9 pointes et 8 pointes',
      '8 pointes et 5 pointes'
    ],
    correctAnswer: '9 pointes et 5 pointes',
    explanation: 'Le Qatar a neuf pointes blanches, Bahreïn en a cinq.',
    sourceUrl: 'https://en.wikipedia.org/wiki/Flag_of_Qatar'
  },
  {
    id: 'culture-hard-canada-2025-anniversary',
    difficulty: 'hard',
    topic: 'history',
    prompt: 'En 2025, quel anniversaire du drapeau à feuille d\'érable le Canada a-t-il célébré ?',
    options: ['60 ans', '50 ans', '55 ans', '65 ans'],
    correctAnswer: '60 ans',
    explanation: 'Le 15 février 2025 marquait le 60e anniversaire de la levée initiale de 1965.',
    countryCode: 'ca',
    sourceUrl: 'https://www.canada.ca/en/canadian-heritage/news/2025/02/statement-by-minister-st-onge-on-the-60th-anniversary-of-the-national-flag-of-canada.html'
  },
  {
    id: 'culture-hard-canada-2026-anniversary',
    difficulty: 'hard',
    topic: 'history',
    prompt: 'Le 15 février 2026 correspondait au combientième anniversaire du drapeau canadien moderne ?',
    options: ['61e', '60e', '62e', '59e'],
    correctAnswer: '61e',
    explanation: 'Le gouvernement canadien a rappelé le 61e anniversaire du drapeau en 2026.',
    countryCode: 'ca',
    sourceUrl: 'https://www.canada.ca/en/canadian-heritage/news/2026/02/statement-by-minister-miller-on-national-flag-of-canada-day.html'
  }
];









