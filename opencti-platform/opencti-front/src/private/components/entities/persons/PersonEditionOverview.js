import React, { Component } from 'react';
import * as PropTypes from 'prop-types';
import graphql from 'babel-plugin-relay/macro';
import { createFragmentContainer } from 'react-relay';
import { Formik, Form, Field } from 'formik';
import { withStyles } from '@material-ui/core/styles';
import {
  assoc,
  compose,
  map,
  pathOr,
  pipe,
  pick,
  difference,
  head,
} from 'ramda';
import * as Yup from 'yup';
import inject18n from '../../../../components/i18n';
import TextField from '../../../../components/TextField';
import { SubscriptionFocus } from '../../../../components/Subscription';
import { commitMutation } from '../../../../relay/environment';
import CreatedByRefField from '../../common/form/CreatedByRefField';
import MarkingDefinitionsField from '../../common/form/MarkingDefinitionsField';

const styles = (theme) => ({
  drawerPaper: {
    minHeight: '100vh',
    width: '50%',
    position: 'fixed',
    overflow: 'hidden',
    backgroundColor: theme.palette.navAlt.background,
    transition: theme.transitions.create('width', {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen,
    }),
    padding: '30px 30px 30px 30px',
  },
  createButton: {
    position: 'fixed',
    bottom: 30,
    right: 30,
  },
  importButton: {
    position: 'absolute',
    top: 30,
    right: 30,
  },
});

const personMutationFieldPatch = graphql`
  mutation PersonEditionOverviewFieldPatchMutation(
    $id: ID!
    $input: EditInput!
  ) {
    personEdit(id: $id) {
      fieldPatch(input: $input) {
        ...PersonEditionOverview_person
      }
    }
  }
`;

export const personEditionOverviewFocus = graphql`
  mutation PersonEditionOverviewFocusMutation($id: ID!, $input: EditContext!) {
    personEdit(id: $id) {
      contextPatch(input: $input) {
        id
      }
    }
  }
`;

const personMutationRelationAdd = graphql`
  mutation PersonEditionOverviewRelationAddMutation(
    $id: ID!
    $input: RelationAddInput!
  ) {
    personEdit(id: $id) {
      relationAdd(input: $input) {
        from {
          ...PersonEditionOverview_person
        }
      }
    }
  }
`;

const personMutationRelationDelete = graphql`
  mutation PersonEditionOverviewRelationDeleteMutation(
    $id: ID!
    $relationId: ID!
  ) {
    personEdit(id: $id) {
      relationDelete(relationId: $relationId) {
        ...PersonEditionOverview_person
      }
    }
  }
`;

const personValidation = (t) => Yup.object().shape({
  name: Yup.string().required(t('This field is required')),
  description: Yup.string()
    .min(3, t('The value is too short'))
    .max(5000, t('The value is too long'))
    .required(t('This field is required')),
});

class PersonEditionOverviewComponent extends Component {
  handleChangeFocus(name) {
    commitMutation({
      mutation: personEditionOverviewFocus,
      variables: {
        id: this.props.person.id,
        input: {
          focusOn: name,
        },
      },
    });
  }

  handleSubmitField(name, value) {
    personValidation(this.props.t)
      .validateAt(name, { [name]: value })
      .then(() => {
        commitMutation({
          mutation: personMutationFieldPatch,
          variables: { id: this.props.person.id, input: { key: name, value } },
        });
      })
      .catch(() => false);
  }

  handleChangeCreatedByRef(name, value) {
    const { person } = this.props;
    const currentCreatedByRef = {
      label: pathOr(null, ['createdByRef', 'node', 'name'], person),
      value: pathOr(null, ['createdByRef', 'node', 'id'], person),
      relation: pathOr(null, ['createdByRef', 'relation', 'id'], person),
    };

    if (currentCreatedByRef.value === null) {
      commitMutation({
        mutation: personMutationRelationAdd,
        variables: {
          id: this.props.person.id,
          input: {
            fromRole: 'so',
            toId: value.value,
            toRole: 'creator',
            through: 'created_by_ref',
          },
        },
      });
    } else if (currentCreatedByRef.value !== value.value) {
      commitMutation({
        mutation: personMutationRelationDelete,
        variables: {
          id: this.props.person.id,
          relationId: currentCreatedByRef.relation,
        },
      });
      if (value.value) {
        commitMutation({
          mutation: personMutationRelationAdd,
          variables: {
            id: this.props.person.id,
            input: {
              fromRole: 'so',
              toId: value.value,
              toRole: 'creator',
              through: 'created_by_ref',
            },
          },
        });
      }
    }
  }

  handleChangeMarkingDefinitions(name, values) {
    const { person } = this.props;
    const currentMarkingDefinitions = pipe(
      pathOr([], ['markingDefinitions', 'edges']),
      map((n) => ({
        label: n.node.definition,
        value: n.node.id,
        relationId: n.relation.id,
      })),
    )(person);

    const added = difference(values, currentMarkingDefinitions);
    const removed = difference(currentMarkingDefinitions, values);

    if (added.length > 0) {
      commitMutation({
        mutation: personMutationRelationAdd,
        variables: {
          id: this.props.person.id,
          input: {
            fromRole: 'so',
            toId: head(added).value,
            toRole: 'marking',
            through: 'object_marking_refs',
          },
        },
      });
    }

    if (removed.length > 0) {
      commitMutation({
        mutation: personMutationRelationDelete,
        variables: {
          id: this.props.person.id,
          relationId: head(removed).relationId,
        },
      });
    }
  }

  render() {
    const { t, person, context } = this.props;
    const external = person.external === true;
    const createdByRef = pathOr(null, ['createdByRef', 'node', 'name'], person) === null
      ? ''
      : {
        label: pathOr(null, ['createdByRef', 'node', 'name'], person),
        value: pathOr(null, ['createdByRef', 'node', 'id'], person),
        relation: pathOr(null, ['createdByRef', 'relation', 'id'], person),
      };
    const markingDefinitions = pipe(
      pathOr([], ['markingDefinitions', 'edges']),
      map((n) => ({
        label: n.node.definition,
        value: n.node.id,
        relationId: n.relation.id,
      })),
    )(person);
    const initialValues = pipe(
      assoc('createdByRef', createdByRef),
      assoc('markingDefinitions', markingDefinitions),
      pick(['name', 'description', 'createdByRef', 'markingDefinitions']),
    )(person);
    return (
      <Formik
        enableReinitialize={true}
        initialValues={initialValues}
        validationSchema={personValidation(t)}
        onSubmit={() => true}
      >
        {({ setFieldValue }) => (
          <Form style={{ margin: '20px 0 20px 0' }}>
            <Field
              component={TextField}
              name="name"
              disabled={external}
              label={t('Name')}
              fullWidth={true}
              onFocus={this.handleChangeFocus.bind(this)}
              onSubmit={this.handleSubmitField.bind(this)}
              helperText={
                <SubscriptionFocus context={context} fieldName="name" />
              }
            />
            <Field
              component={TextField}
              name="description"
              label={t('Description')}
              fullWidth={true}
              multiline={true}
              rows="4"
              style={{ marginTop: 20 }}
              onFocus={this.handleChangeFocus.bind(this)}
              onSubmit={this.handleSubmitField.bind(this)}
              helperText={
                <SubscriptionFocus context={context} fieldName="description" />
              }
            />
            <CreatedByRefField
              name="createdByRef"
              style={{ marginTop: 20, width: '100%' }}
              setFieldValue={setFieldValue}
              helpertext={
                <SubscriptionFocus context={context} fieldName="createdByRef" />
              }
              onChange={this.handleChangeCreatedByRef.bind(this)}
            />
            <MarkingDefinitionsField
              name="markingDefinitions"
              style={{ marginTop: 20, width: '100%' }}
              helpertext={
                <SubscriptionFocus
                  context={context}
                  fieldName="markingDefinitions"
                />
              }
              onChange={this.handleChangeMarkingDefinitions.bind(this)}
            />
          </Form>
        )}
      </Formik>
    );
  }
}

PersonEditionOverviewComponent.propTypes = {
  classes: PropTypes.object,
  theme: PropTypes.object,
  t: PropTypes.func,
  person: PropTypes.object,
  context: PropTypes.array,
};

const PersonEditionOverview = createFragmentContainer(
  PersonEditionOverviewComponent,
  {
    person: graphql`
      fragment PersonEditionOverview_person on User {
        id
        name
        description
        external
        createdByRef {
          node {
            id
            name
            entity_type
          }
          relation {
            id
          }
        }
        markingDefinitions {
          edges {
            node {
              id
              definition
              definition_type
            }
            relation {
              id
            }
          }
        }
      }
    `,
  },
);

export default compose(
  inject18n,
  withStyles(styles, { withTheme: true }),
)(PersonEditionOverview);
